'use client';
/**
 * ActivityLayer: renders activity markers, clusters and labels on a host globe.
 * Mount it inside the host's react-three-fiber <Canvas>.
 *
 * - One InstancedMesh per category (12 draw calls max), billboarded tokens with
 *   constant screen size. Size grows with heat. Out-of-season spots at 25% opacity.
 * - Clusters at world zoom (grid on lat/lng), count badges as DOM buttons.
 * - Up to `maxLabels` labels, sorted by season then heat, never overlapping.
 * - Tap: fly to the spot, then open the card. Hover tooltip only on fine pointers.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { CATEGORIES, CATEGORY_META, type Activity, type Category } from '@/lib/activity/activities';
import { bestLine, isInSeason } from '@/lib/activity/season';
import { useActivityStore } from '@/lib/activity/store';
import { buildMarkerTextures, buildRingTexture, glyphColor } from './markerTextures';
import styles from './spot.module.css';

export interface FlyOptions {
  /** "cluster" asks the host to zoom in closer than its current distance. */
  zoom?: "spot" | "cluster";
}

export interface ActivityLayerProps {
  activities: Activity[];
  /** Host adapter: surface position for a lat/lng. `altitude` is a fraction of the globe radius. */
  latLngToVector3: (lat: number, lng: number, altitude: number) => THREE.Vector3;
  /** Host adapter: move the camera. Resolve the promise when the flight ends. */
  flyTo: (lat: number, lng: number, opts?: FlyOptions) => Promise<void> | void;
  /** Host adapter: called after the card opens (id) and when it closes (null). */
  onSelect?: (id: string | null) => void;
  globeCenter?: THREE.Vector3;
  markerAltitude?: number;
  maxLabels?: number;
  /** Show summit elevation next to ski labels (ski mode). */
  showElevation?: boolean;
  /** Override "today" (tests, demos). */
  now?: Date;
  /** Pixels at the top of the canvas covered by host UI (filters). Labels are not placed there. */
  topInset?: number;
}

const VERT = /* glsl */ `
  uniform float uPx;
  uniform vec3 uCenter;
  attribute vec3 aCenter;
  attribute float aSize;
  attribute float aAlpha;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(aCenter, 1.0);
    float facing = dot(normalize(aCenter - uCenter), normalize(cameraPosition - uCenter));
    vAlpha = aAlpha * smoothstep(0.04, 0.22, facing);
    float s = aSize * uPx * -mv.z;
    mv.xy += position.xy * s;
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */ `
  uniform sampler2D uTex;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    vec4 c = texture2D(uTex, vUv);
    float a = c.a * vAlpha;
    if (a < 0.02) discard;
    gl_FragColor = vec4(c.rgb, a);
  }
`;

type Cluster = { anchor: number; members: number[]; color: string; pos: THREE.Vector3; inSeason: boolean };

const LABEL_H = 26;

export default function ActivityLayer({
  activities,
  latLngToVector3,
  flyTo,
  onSelect,
  globeCenter,
  markerAltitude = 0.012,
  maxLabels = 12,
  showElevation = false,
  now,
  topInset = 0,
}: ActivityLayerProps) {
  const { camera, gl, size } = useThree();
  const month = useActivityStore((s) => s.month);
  const categories = useActivityStore((s) => s.categories);
  const selectedId = useActivityStore((s) => s.selectedId);
  const pendingId = useActivityStore((s) => s.pendingId);
  const request = useActivityStore((s) => s.request);

  const center = useMemo(() => globeCenter ?? new THREE.Vector3(), [globeCenter]);
  const today = useMemo(() => now ?? new Date(), [now]);
  const n = activities.length;

  const positions = useMemo(
    () => activities.map((a) => latLngToVector3(a.lat, a.lng, markerAltitude)),
    [activities, latLngToVector3, markerAltitude],
  );
  const radius = useMemo(() => latLngToVector3(0, 0, 0).distanceTo(center), [latLngToVector3, center]);
  const indexById = useMemo(() => new Map(activities.map((a, i) => [a.id, i])), [activities]);
  const byCat = useMemo(() => {
    const m = {} as Record<Category, number[]>;
    CATEGORIES.forEach((c) => (m[c] = []));
    activities.forEach((a, i) => m[a.category].push(i));
    return m;
  }, [activities]);

  // ---------- GPU objects
  const [textures, setTextures] = useState<Record<Category, THREE.Texture> | null>(null);
  useEffect(() => {
    let live = true;
    buildMarkerTextures().then((t) => live && setTextures(t));
    return () => {
      live = false;
    };
  }, []);

  const uniformsShared = useMemo(() => ({ uPx: { value: 0.002 }, uCenter: { value: center } }), [center]);

  const group = useMemo(() => new THREE.Group(), []);
  const meshes = useMemo(() => {
    if (!textures) return null;
    const out = {} as Record<Category, THREE.InstancedMesh | null>;
    for (const cat of CATEGORIES) {
      const idx = byCat[cat];
      if (!idx.length) {
        out[cat] = null;
        continue;
      }
      const geom = new THREE.PlaneGeometry(1, 1);
      geom.setAttribute("aCenter", new THREE.InstancedBufferAttribute(new Float32Array(idx.length * 3), 3));
      geom.setAttribute("aSize", new THREE.InstancedBufferAttribute(new Float32Array(idx.length), 1));
      geom.setAttribute("aAlpha", new THREE.InstancedBufferAttribute(new Float32Array(idx.length), 1));
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { ...uniformsShared, uTex: { value: textures[cat] } },
        transparent: true,
        depthWrite: false,
        depthTest: false, // back side is hidden by the facing fade; depth would clip tokens at the limb
      });
      const mesh = new THREE.InstancedMesh(geom, mat, idx.length);
      mesh.frustumCulled = false;
      mesh.renderOrder = 10;
      mesh.name = `activity-${cat}`;
      out[cat] = mesh;
    }
    return out;
  }, [textures, byCat, uniformsShared]);

  const ring = useMemo(() => {
    const geom = new THREE.PlaneGeometry(1, 1);
    geom.setAttribute("aCenter", new THREE.InstancedBufferAttribute(new Float32Array(3), 3));
    geom.setAttribute("aSize", new THREE.InstancedBufferAttribute(new Float32Array([0]), 1));
    geom.setAttribute("aAlpha", new THREE.InstancedBufferAttribute(new Float32Array([1]), 1));
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { ...uniformsShared, uTex: { value: buildRingTexture() } },
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    const m = new THREE.InstancedMesh(geom, mat, 1);
    m.frustumCulled = false;
    m.renderOrder = 11;
    return m;
  }, [uniformsShared]);

  useEffect(() => {
    if (!meshes) return;
    Object.values(meshes).forEach((m) => m && group.add(m));
    group.add(ring);
    return () => {
      Object.values(meshes).forEach((m) => {
        if (!m) return;
        group.remove(m);
        m.geometry.dispose();
        (m.material as THREE.Material).dispose();
      });
      group.remove(ring);
    };
  }, [meshes, ring, group]);

  // ---------- CPU state (mutable, no re-render per frame)
  const st = useRef({
    visible: new Uint8Array(0),
    inSeason: new Uint8Array(0),
    clustered: new Uint8Array(0),
    sizePx: new Float32Array(0),
    order: [] as number[],
    clusters: [] as Cluster[],
    level: -1, // current cluster cell size in degrees
    dirty: true,
    lastCam: new THREE.Matrix4(),
    lastProj: new THREE.Matrix4(),
    lastW: 0,
    lastH: 0,
    hoverId: null as string | null,
  });

  const reduceMotion = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );
  const canHover = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(hover: hover) and (pointer: fine)").matches,
    [],
  );

  const recompute = (cell: number) => {
    const s = st.current;
    if (s.visible.length !== n) {
      s.visible = new Uint8Array(n);
      s.inSeason = new Uint8Array(n);
      s.clustered = new Uint8Array(n);
      s.sizePx = new Float32Array(n);
    }
    const cats = new Set(categories);
    const sel = useActivityStore.getState().selectedId ?? useActivityStore.getState().pendingId;
    for (let i = 0; i < n; i++) {
      const a = activities[i];
      s.visible[i] = cats.size === 0 || cats.has(a.category) ? 1 : 0;
      s.inSeason[i] = isInSeason(a, month, today) ? 1 : 0;
      s.clustered[i] = 0;
      s.sizePx[i] = 22 + ((a.heat ?? 30) / 100) * 14;
    }
    // At world zoom only what's in season shows; closer in, the rest comes back dimmed.
    if (cell >= 6) for (let i = 0; i < n; i++) if (!s.inSeason[i]) s.visible[i] = 0;
    // Clusters
    s.clusters = [];
    if (cell) {
      const cells = new Map<string, number[]>();
      for (let i = 0; i < n; i++) {
        if (!s.visible[i] || activities[i].id === sel) continue;
        const a = activities[i];
        const row = Math.floor((a.lat + 90) / cell);
        const latMid = row * cell - 90 + cell / 2;
        const cw = cell / Math.max(Math.cos((latMid * Math.PI) / 180), 0.35);
        // In-season and out-of-season spots cluster separately so a badge can fade like its markers.
        const key = row + ":" + Math.floor((a.lng + 180) / cw) + ":" + s.inSeason[i];
        const list = cells.get(key);
        if (list) list.push(i);
        else cells.set(key, [i]);
      }
      for (const members of cells.values()) {
        if (members.length < 3) continue;
        let anchor = members[0];
        const count: Record<string, number> = {};
        for (const i of members) {
          if ((activities[i].heat ?? 0) > (activities[anchor].heat ?? 0)) anchor = i;
          count[activities[i].category] = (count[activities[i].category] ?? 0) + 1;
          s.clustered[i] = 1;
        }
        const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0][0] as Category;
        s.clusters.push({ anchor, members, color: CATEGORY_META[top].color, pos: positions[anchor], inSeason: !!s.inSeason[members[0]] });
      }
    }
    // Label order: visible, unclustered, in season first, then heat.
    s.order = [];
    for (let i = 0; i < n; i++) if (s.visible[i] && !s.clustered[i]) s.order.push(i);
    s.order.sort((a, b) => s.inSeason[b] - s.inSeason[a] || (activities[b].heat ?? 0) - (activities[a].heat ?? 0));
    // Instance attributes
    if (meshes) {
      for (const cat of CATEGORIES) {
        const mesh = meshes[cat];
        if (!mesh) continue;
        const idx = byCat[cat];
        const g = mesh.geometry;
        const c = g.getAttribute("aCenter") as THREE.InstancedBufferAttribute;
        const sz = g.getAttribute("aSize") as THREE.InstancedBufferAttribute;
        const al = g.getAttribute("aAlpha") as THREE.InstancedBufferAttribute;
        idx.forEach((i, k) => {
          const p = positions[i];
          c.setXYZ(k, p.x, p.y, p.z);
          const show = s.visible[i] && !s.clustered[i];
          sz.setX(k, show ? s.sizePx[i] : 0);
          al.setX(k, show ? (s.inSeason[i] ? 1 : 0.25) : 0);
        });
        c.needsUpdate = sz.needsUpdate = al.needsUpdate = true;
      }
    }
    s.dirty = true;
  };

  // Recompute when inputs change.
  useEffect(() => {
    recompute(Math.max(st.current.level, 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meshes, positions, month, categories, today, selectedId, pendingId]);

  // ---------- DOM overlay (labels, clusters, tooltip)
  const overlay = useRef<{
    root: HTMLDivElement;
    labels: HTMLButtonElement[];
    clusters: HTMLButtonElement[];
    tip: HTMLDivElement;
  } | null>(null);

  const selectRef = useRef<(id: string) => void>(() => {});
  const clusterTapRef = useRef<(c: Cluster) => void>(() => {});

  useEffect(() => {
    const host = gl.domElement.parentElement!;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";
    const root = document.createElement("div");
    root.className = styles.overlay;
    root.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;";
    const labels: HTMLButtonElement[] = [];
    for (let i = 0; i < maxLabels; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = styles.label;
      b.style.display = "none";
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        if (b.dataset.id) selectRef.current(b.dataset.id);
      });
      root.appendChild(b);
      labels.push(b);
    }
    const clusters: HTMLButtonElement[] = [];
    for (let i = 0; i < 160; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = styles.cluster;
      b.style.display = "none";
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const c = st.current.clusters[Number(b.dataset.k)];
        if (c) clusterTapRef.current(c);
      });
      root.appendChild(b);
      clusters.push(b);
    }
    const tip = document.createElement("div");
    tip.className = styles.tip;
    tip.setAttribute("role", "tooltip");
    tip.style.display = "none";
    root.appendChild(tip);
    host.appendChild(root);
    overlay.current = { root, labels, clusters, tip };
    st.current.dirty = true;
    return () => {
      root.remove();
      overlay.current = null;
    };
  }, [gl, maxLabels]);

  // ---------- Selection flow: close any open card, fly, then open.
  const select = async (id: string) => {
    const i = indexById.get(id);
    if (i === undefined) return;
    const store = useActivityStore.getState();
    store.setPending(id);
    if (store.selectedId) useActivityStore.setState({ selectedId: null });
    hideTip();
    const a = activities[i];
    await Promise.resolve(flyTo(a.lat, a.lng, { zoom: "spot" }));
    if (useActivityStore.getState().pendingId !== id) return; // superseded by a newer tap
    useActivityStore.getState().openCard(id);
    onSelect?.(id);
  };
  selectRef.current = select;
  clusterTapRef.current = (c) => {
    const a = activities[c.anchor];
    hideTip();
    flyTo(a.lat, a.lng, { zoom: "cluster" });
  };

  // Requests from outside the canvas (card "More here" rows, search, deep links).
  useEffect(() => {
    if (request) select(request.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  // Notify host on close.
  const prevSel = useRef<string | null>(null);
  useEffect(() => {
    if (prevSel.current && !selectedId && !pendingId) onSelect?.(null);
    prevSel.current = selectedId;
  }, [selectedId, pendingId, onSelect]);

  // ---------- Picking
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const camDir = useMemo(() => new THREE.Vector3(), []);
  const project = (p: THREE.Vector3) => {
    tmp.copy(p).project(camera);
    return { x: ((tmp.x + 1) / 2) * size.width, y: ((1 - tmp.y) / 2) * size.height, z: tmp.z };
  };
  const facing = (p: THREE.Vector3) => {
    camDir.copy(camera.position).sub(center).normalize();
    return tmp.copy(p).sub(center).normalize().dot(camDir);
  };
  const pick = (x: number, y: number): number | null => {
    const s = st.current;
    let best: number | null = null;
    let bestD = Infinity;
    for (const i of s.order) {
      const p = positions[i];
      if (facing(p) < 0.15) continue;
      const q = project(p);
      const d = Math.hypot(q.x - x, q.y - y);
      const r = Math.max(22, s.sizePx[i] / 2 + 4); // 44 px minimum tap target
      if (d <= r && d < bestD) {
        best = i;
        bestD = d;
      }
    }
    return best;
  };

  const hideTip = () => {
    const o = overlay.current;
    if (o) o.tip.style.display = "none";
    st.current.hoverId = null;
    gl.domElement.style.cursor = "";
  };

  useEffect(() => {
    const el = gl.domElement;
    let down: { x: number; y: number; t: number } | null = null;
    const local = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const onDown = (e: PointerEvent) => {
      const p = local(e);
      down = { ...p, t: performance.now() };
    };
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      const p = local(e);
      const moved = Math.hypot(p.x - down.x, p.y - down.y);
      const dt = performance.now() - down.t;
      down = null;
      if (moved > 8 || dt > 600) return;
      const i = pick(p.x, p.y);
      if (i === null) return;
      // This tap is ours: keep the click that follows from also picking a beacon underneath.
      const swallow = (ev: MouseEvent) => ev.stopPropagation();
      el.addEventListener("click", swallow, { once: true });
      window.setTimeout(() => el.removeEventListener("click", swallow), 500);
      select(activities[i].id);
    };
    const onMove = (e: PointerEvent) => {
      if (!canHover || e.pointerType !== "mouse" || e.buttons) return;
      const o = overlay.current;
      if (!o) return;
      const s = useActivityStore.getState();
      if (s.selectedId || s.pendingId) return hideTip(); // one card or popup at a time
      const p = local(e);
      const i = pick(p.x, p.y);
      if (i === null) return hideTip();
      const a = activities[i];
      el.style.cursor = "pointer";
      if (st.current.hoverId !== a.id) {
        st.current.hoverId = a.id;
        o.tip.innerHTML = `<strong>${esc(a.name)}</strong><span>${esc(CATEGORY_META[a.category].label)} · ${esc(a.place)}</span><span>${esc(bestLine(a))}</span>`;
      }
      o.tip.style.display = "flex";
      const tx = Math.min(p.x + 16, size.width - 240);
      o.tip.style.transform = `translate(${tx}px, ${p.y + 16}px)`;
    };
    const onLeave = () => hideTip();
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, positions, activities, size, canHover]);

  // Hide the hover tooltip whenever a card opens.
  useEffect(() => {
    if (selectedId || pendingId) hideTip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, pendingId]);

  // ---------- Per frame
  useFrame((state) => {
    const perf = (globalThis as { __paPerf?: { n: number; ms: number; max: number } }).__paPerf;
    const t0 = perf ? performance.now() : 0;
    frame(state);
    if (perf) {
      const dt = performance.now() - t0;
      perf.n++;
      perf.ms += dt;
      perf.max = Math.max(perf.max, dt);
    }
  });

  const frame = (state: { clock: THREE.Clock }) => {
    const s = st.current;
    const cam = camera as THREE.PerspectiveCamera;
    // The camera rig moved the camera this frame; project labels with where it is now, not last frame.
    cam.updateMatrixWorld();
    uniformsShared.uPx.value = (2 * Math.tan(((cam.fov ?? 45) * Math.PI) / 360)) / size.height;

    // Zoom is measured as the globe's on-screen radius, so phones and desktops cluster alike.
    const dist = camera.position.distanceTo(center) / radius;
    const globePx = size.height / 2 / (Math.sqrt(Math.max(dist * dist - 1, 0.01)) * Math.tan(((cam.fov ?? 45) * Math.PI) / 360));
    const cellRaw = (44 * 180) / Math.PI / globePx; // degrees covered by ~44 px at the globe center
    const cell = cellRaw < 2.5 ? 0 : cellRaw < 4.5 ? 3 : cellRaw < 9 ? 6 : cellRaw < 16 ? 12 : 20;
    if (cell !== s.level) {
      s.level = cell;
      recompute(cell);
    }

    // Selection ring
    const selId = useActivityStore.getState().selectedId ?? useActivityStore.getState().pendingId;
    const si = selId ? indexById.get(selId) : undefined;
    const rs = ring.geometry.getAttribute("aSize") as THREE.InstancedBufferAttribute;
    if (si !== undefined) {
      const rc = ring.geometry.getAttribute("aCenter") as THREE.InstancedBufferAttribute;
      const p = positions[si];
      rc.setXYZ(0, p.x, p.y, p.z);
      rc.needsUpdate = true;
      const pulse = reduceMotion ? 0 : Math.sin(state.clock.elapsedTime * 3) * 3;
      rs.setX(0, s.sizePx[si] + 14 + pulse);
    } else rs.setX(0, 0);
    rs.needsUpdate = true;

    // Overlay only when the camera or data changed.
    const o = overlay.current;
    if (!o) return;
    // The projection changes too when the host shifts the view (a card opening), so watch both.
    if (!s.dirty && s.lastCam.equals(camera.matrixWorld) && s.lastProj.equals(camera.projectionMatrix) && s.lastW === size.width && s.lastH === size.height) return;
    s.lastCam.copy(camera.matrixWorld);
    s.lastProj.copy(camera.projectionMatrix);
    s.lastW = size.width;
    s.lastH = size.height;
    s.dirty = false;

    const placed: { l: number; r: number; t: number; b: number }[] = [];
    // Clusters first: they own their screen space. Badges that would overlap on screen merge
    // into the larger one, so the world view stays readable.
    const shown: { k: number; x: number; y: number; count: number; d: number }[] = [];
    const order = s.clusters.map((c, k) => k).sort((x, y) => s.clusters[y].members.length - s.clusters[x].members.length);
    for (const k of order) {
      const c = s.clusters[k];
      if (facing(c.pos) < 0.2) continue;
      const q = project(c.pos);
      if (q.x < -40 || q.y < -40 || q.x > size.width + 40 || q.y > size.height + 40) continue;
      const hit = shown.find((z) => s.clusters[z.k].inSeason === c.inSeason && Math.hypot(z.x - q.x, z.y - q.y) < 40);
      if (hit) {
        hit.count += c.members.length;
        continue;
      }
      shown.push({ k, x: q.x, y: q.y, count: c.members.length, d: 0 });
    }
    // Out-of-season badges go first in DOM order so in-season badges paint on top.
    shown.sort((x, y) => Number(s.clusters[x.k].inSeason) - Number(s.clusters[y.k].inSeason));
    let ci = 0;
    for (const z of shown) {
      if (ci >= o.clusters.length) break;
      const c = s.clusters[z.k];
      const b = o.clusters[ci++];
      const d = Math.round(Math.min(46, 28 + Math.sqrt(z.count) * 2.4)); // visual size; hit area is at least 44 px
      const box = Math.max(44, d);
      if (b.dataset.k !== String(z.k) || b.dataset.n !== String(z.count)) {
        b.dataset.k = String(z.k);
        b.dataset.n = String(z.count);
        b.textContent = String(z.count);
        b.setAttribute("aria-label", `${z.count} ${c.inSeason ? "in-season" : "out-of-season"} spots near ${activities[c.anchor].place}. Zoom in`);
        b.style.setProperty("--pa-c", c.color);
        b.style.setProperty("--pa-d", d + "px");
        b.style.color = glyphColor(c.color);
      }
      b.style.width = b.style.height = box + "px";
      b.style.transform = `translate(${z.x - box / 2}px, ${z.y - box / 2}px)`;
      b.classList.toggle(styles.off, !c.inSeason);
      b.style.display = "flex";
      placed.push({ l: z.x - d / 2, r: z.x + d / 2, t: z.y - d / 2, b: z.y + d / 2 });
    }
    for (; ci < o.clusters.length; ci++) o.clusters[ci].style.display = "none";

    // Labels: more as the user zooms in, never more than maxLabels.
    // Phones start with 6 at world zoom; more room (desktop, or zoomed in) earns more.
    const phone = size.width < 600;
    const cap = Math.min(maxLabels, phone ? (globePx < 700 ? 6 : globePx < 1400 ? 9 : maxLabels) : globePx < 300 ? 6 : globePx < 600 ? 9 : maxLabels);
    let li = 0;
    const sel = si;
    const candidates = sel !== undefined && s.visible[sel] ? [sel, ...s.order.filter((x) => x !== sel)] : s.order;
    for (const i of candidates) {
      if (li >= cap) break;
      const p = positions[i];
      if (facing(p) < 0.3) continue;
      const q = project(p);
      if (q.x < 0 || q.y < 0 || q.x > size.width || q.y > size.height) continue;
      const a = activities[i];
      const text = showElevation && a.category === "ski" && a.elevationFt ? `${a.name} · ${a.elevationFt.toLocaleString("en-US")} ft` : a.name;
      const half = s.sizePx[i] / 2;
      const markerBox = { l: q.x - half, r: q.x + half, t: q.y - half, b: q.y + half };
      // Right of the marker first, then left. On narrow screens the label truncates to the room it has.
      const want = Math.min(220, text.length * 7 + 22);
      const roomR = size.width - 4 - (q.x + half + 2);
      const roomL = q.x - half - 2 - 4;
      const t = q.y - LABEL_H / 2, bt = q.y + LABEL_H / 2;
      if (t < topInset) continue;
      const tries: { left: number; w: number }[] = [];
      if (roomR >= 84) tries.push({ left: q.x + half + 2, w: Math.min(want, roomR) });
      if (roomL >= 84) tries.push({ left: q.x - half - 2 - Math.min(want, roomL), w: Math.min(want, roomL) });
      const pick = tries.find((c) => !placed.some((z) => overlaps(z, { l: c.left, r: c.left + c.w, t, b: bt })));
      if (!pick) continue;
      const { left, w } = pick;
      const box = { l: left, r: left + w, t, b: bt };
      placed.push(box, markerBox);
      const b = o.labels[li++];
      if (b.dataset.id !== a.id || b.dataset.t !== text) {
        b.dataset.id = a.id;
        b.dataset.t = text;
        b.innerHTML = `<span class="${styles.dot}" style="background:${CATEGORY_META[a.category].color}"></span><span class="${styles.text}">${esc(text)}</span>`;
        b.setAttribute("aria-label", `${a.name}, ${CATEGORY_META[a.category].label} in ${a.place}, ${a.country}`);
      }
      b.classList.toggle(styles.off, !s.inSeason[i]);
      b.classList.toggle(styles.sel, i === sel);
      // The marker's own screen point, so a check can hold labels to their markers.
      b.dataset.mx = String(Math.round(q.x));
      b.dataset.my = String(Math.round(q.y));
      b.style.transform = `translate(${left - 6}px, ${q.y - 22}px)`;
      b.style.maxWidth = w + 12 + "px";
      b.style.display = "flex";
    }
    for (; li < o.labels.length; li++) {
      o.labels[li].style.display = "none";
      delete o.labels[li].dataset.id;
    }
  };

  return <primitive object={group} />;
}

function overlaps(a: { l: number; r: number; t: number; b: number }, b: { l: number; r: number; t: number; b: number }) {
  return a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
