'use client';
import * as THREE from "three";
import {
  Building2, Flower2, Landmark, Martini, MountainSnow, Music, PartyPopper, Trees, Trophy, Umbrella, UtensilsCrossed, Waves,
  type IconNode,
} from "lucide";
import { CATEGORIES, CATEGORY_META, type Category } from "@/lib/activity/activities";

/** Same glyphs as icons.tsx, as raw nodes so tokens can be drawn without React. */
const GLYPH: Record<Category, IconNode> = {
  ski: MountainSnow, surf: Waves, beach: Umbrella, festival: PartyPopper, concert: Music, sports: Trophy,
  food: UtensilsCrossed, nightlife: Martini, nature: Trees, culture: Landmark, wellness: Flower2, city: Building2,
};

const SIZE = 128;

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

/** Glyph color with the better contrast on the token fill. */
export function glyphColor(hex: string) {
  return luminance(hex) > 0.18 ? "#050505" : "#F4F1EA";
}

function iconSvg(cat: Category, color: string): string {
  const body = GLYPH[cat]
    .map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(" ")}/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

/** One marker token per category: filled disc, dark keyline, category glyph. */
export async function buildMarkerTextures(): Promise<Record<Category, THREE.Texture>> {
  const out = {} as Record<Category, THREE.Texture>;
  await Promise.all(
    CATEGORIES.map(async (cat) => {
      const color = CATEGORY_META[cat].color;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = SIZE;
      const ctx = canvas.getContext("2d")!;
      const r = SIZE / 2;
      ctx.beginPath();
      ctx.arc(r, r, r - 4, 0, Math.PI * 2);
      ctx.fillStyle = "#050505";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(r, r, r - 12, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      try {
        const svg = iconSvg(cat, glyphColor(color));
        const img = await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
        ctx.drawImage(img, r - 30, r - 30, 60, 60);
      } catch {
        /* token without glyph still works */
      }
      const tex = new THREE.CanvasTexture(canvas);
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.anisotropy = 4;
      out[cat] = tex;
    }),
  );
  return out;
}

export function buildRingTexture(): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 6, 0, Math.PI * 2);
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#C8A866";
  ctx.stroke();
  return new THREE.CanvasTexture(canvas);
}
