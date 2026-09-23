'use client';

import { Html, Line, OrbitControls, Stars } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  affinityScore,
  vectorFromMode,
  type AffinityReason,
  type AffinityVector,
  type PartyType,
  type TravelModeInterestRecord,
  type TravelModeRecord,
} from '@/lib/affinity';
import { usePlatformAuth } from '@/lib/platform/usePlatformAuth';
import { PlatformShell, SignInCard } from '@/components/community/PlatformShell';
import communityStyles from '@/components/community/community.module.css';
import styles from './constellation.module.css';

type Point3 = [number, number, number];
type NodeKind = 'self' | 'interest' | 'person' | 'circle';

interface ProfileRow {
  id: string;
  display_name: string;
  home_city: string;
  home_airport: string;
  interests: string[];
  is_public: boolean;
}

interface CircleRow {
  id: string;
  host_id: string;
  event_id: string | null;
  name: string;
  description: string;
  destination: string;
  departure_city: string;
  start_date: string | null;
  end_date: string | null;
  tags: string[];
  party_type: PartyType;
}

interface Match {
  id: string;
  label: string;
  caption: string;
  score: number;
  reasons: AffinityReason[];
}

interface GraphNodeData extends Match {
  kind: NodeKind;
  position: Point3;
}

const NODE_COLOR: Record<NodeKind, string> = {
  self: '#f2a24a',
  interest: '#5ee0c8',
  person: '#f7c548',
  circle: '#7ee787',
};

function circleVector(circle: CircleRow): AffinityVector {
  return {
    interests: (circle.tags ?? []).map((name) => ({ name, weight: 3 })),
    partyType: circle.party_type,
    originCity: circle.departure_city,
    destination: circle.destination,
    startDate: circle.start_date,
    endDate: circle.end_date,
  };
}

function ringPosition(index: number, total: number, radius: number, phase = 0): Point3 {
  const count = Math.max(1, total);
  const angle = (index / count) * Math.PI * 2 + phase;
  return [
    Math.cos(angle) * radius,
    Math.sin(angle * 2.2 + phase) * Math.min(1.15, radius * 0.16),
    Math.sin(angle) * radius,
  ];
}

function ConstellationNode({
  node,
  selected,
  onSelect,
}: {
  node: GraphNodeData;
  selected: boolean;
  onSelect: (node: GraphNodeData) => void;
}) {
  const scoreScale = node.kind === 'self' ? 0.42 : 0.2 + Math.max(0, node.score) / 360;
  return (
    <group position={node.position}>
      <mesh
        scale={selected ? scoreScale * 1.18 : scoreScale}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(node);
        }}
      >
        <sphereGeometry args={[1, 28, 28]} />
        <meshStandardMaterial
          color={NODE_COLOR[node.kind]}
          emissive={NODE_COLOR[node.kind]}
          emissiveIntensity={selected ? 1.8 : 0.72}
          roughness={0.32}
          metalness={node.kind === 'self' ? 0.68 : 0.2}
        />
      </mesh>
      {selected && (
        <mesh scale={scoreScale * 1.75}>
          <sphereGeometry args={[1, 24, 24]} />
          <meshBasicMaterial color={NODE_COLOR[node.kind]} transparent opacity={0.08} />
        </mesh>
      )}
      <Html center distanceFactor={10} position={[0, scoreScale * 1.8 + 0.18, 0]}>
        <div className={styles.nodeLabel}>
          <strong>{node.label}</strong>
          <span>{node.kind === 'interest' ? 'interest' : node.caption}</span>
        </div>
      </Html>
    </group>
  );
}

function GraphScene({
  nodes,
  selectedId,
  onSelect,
}: {
  nodes: GraphNodeData[];
  selectedId: string;
  onSelect: (node: GraphNodeData) => void;
}) {
  const center: Point3 = [0, 0, 0];
  return (
    <>
      <ambientLight intensity={0.75} />
      <pointLight position={[2, 6, 7]} intensity={55} color="#f7c548" />
      <pointLight position={[-6, -2, -4]} intensity={28} color="#5ee0c8" />
      <Stars radius={36} depth={20} count={800} factor={1.3} saturation={0} fade speed={0.15} />

      {nodes
        .filter((node) => node.kind !== 'self')
        .map((node) => (
          <Line
            key={`edge-${node.id}`}
            points={[center, node.position]}
            color={NODE_COLOR[node.kind]}
            lineWidth={node.kind === 'interest' ? 0.75 : 0.55}
            transparent
            opacity={node.kind === 'interest' ? 0.34 : 0.2 + Math.min(0.28, node.score / 300)}
          />
        ))}

      {nodes.map((node) => (
        <ConstellationNode
          key={node.id}
          node={node}
          selected={selectedId === node.id}
          onSelect={onSelect}
        />
      ))}

      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.07}
        minDistance={7}
        maxDistance={18}
        autoRotate
        autoRotateSpeed={0.18}
      />
    </>
  );
}

export function Constellation() {
  const { client, user } = usePlatformAuth();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [modes, setModes] = useState<TravelModeRecord[]>([]);
  const [modeInterests, setModeInterests] = useState<TravelModeInterestRecord[]>([]);
  const [circles, setCircles] = useState<CircleRow[]>([]);
  const [selectedModeId, setSelectedModeId] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState('self');
  const [threshold, setThreshold] = useState(20);
  const [showInterests, setShowInterests] = useState(true);
  const [showPeople, setShowPeople] = useState(true);
  const [showCircles, setShowCircles] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [circleName, setCircleName] = useState('');
  const [creatingCircle, setCreatingCircle] = useState(false);
  const [notice, setNotice] = useState('');

  const loadData = useCallback(async () => {
    if (!client || !user) return;
    setLoading(true);
    setLoadError('');
    try {
      const [profileResult, modeResult, interestResult, circleResult] = await Promise.all([
        client
          .from('profiles')
          .select('id,display_name,home_city,home_airport,interests,is_public'),
        client
          .from('travel_modes')
          .select(
            'id,user_id,name,description,party_type,origin_city,origin_airport,destination,start_date,end_date,visibility',
          ),
        client.from('travel_mode_interests').select('mode_id,interest,weight'),
        client
          .from('circles')
          .select(
            'id,host_id,event_id,name,description,destination,departure_city,start_date,end_date,tags,party_type',
          ),
      ]);

      const failure =
        profileResult.error || modeResult.error || interestResult.error || circleResult.error;
      if (failure) throw failure;

      setProfiles((profileResult.data ?? []) as ProfileRow[]);
      setModes((modeResult.data ?? []) as TravelModeRecord[]);
      setModeInterests((interestResult.data ?? []) as TravelModeInterestRecord[]);
      setCircles((circleResult.data ?? []) as CircleRow[]);
    } catch (cause) {
      setLoadError(
        cause instanceof Error
          ? cause.message
          : 'Constellation data could not be loaded. Apply migration 003_affinity_graph.sql first.',
      );
    } finally {
      setLoading(false);
    }
  }, [client, user]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const ownModes = useMemo(
    () => modes.filter((mode) => mode.user_id === user?.id),
    [modes, user?.id],
  );

  useEffect(() => {
    if (selectedModeId && ownModes.some((mode) => mode.id === selectedModeId)) return;
    setSelectedModeId(ownModes[0]?.id ?? '');
  }, [ownModes, selectedModeId]);

  const activeMode = useMemo(
    () => ownModes.find((mode) => mode.id === selectedModeId) ?? null,
    [ownModes, selectedModeId],
  );

  useEffect(() => {
    if (!activeMode) return;
    setCircleName(`${activeMode.name} Circle`);
    setSelectedNodeId('self');
  }, [activeMode]);

  const activeVector = useMemo(
    () => (activeMode ? vectorFromMode(activeMode, modeInterests) : null),
    [activeMode, modeInterests],
  );

  const peopleMatches = useMemo(() => {
    if (!activeVector || !user) return [] as Match[];
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    const best = new Map<string, Match>();

    for (const mode of modes) {
      if (mode.user_id === user.id) continue;
      const profile = profileMap.get(mode.user_id);
      if (!profile) continue;
      const result = affinityScore(activeVector, vectorFromMode(mode, modeInterests));
      if (result.score < threshold) continue;
      const candidate: Match = {
        id: `person:${mode.user_id}`,
        label: profile.display_name || 'dope.travel traveler',
        caption: [mode.name, profile.home_city].filter(Boolean).join(' · '),
        score: result.score,
        reasons: result.reasons,
      };
      const current = best.get(mode.user_id);
      if (!current || candidate.score > current.score) best.set(mode.user_id, candidate);
    }

    return [...best.values()].sort((a, b) => b.score - a.score).slice(0, 10);
  }, [activeVector, modes, modeInterests, profiles, threshold, user]);

  const circleMatches = useMemo(() => {
    if (!activeVector) return [] as Match[];
    return circles
      .map((circle) => {
        const result = affinityScore(activeVector, circleVector(circle));
        return {
          id: `circle:${circle.id}`,
          label: circle.name,
          caption: [circle.destination, circle.departure_city ? `from ${circle.departure_city}` : '']
            .filter(Boolean)
            .join(' · '),
          score: result.score,
          reasons: result.reasons,
        } satisfies Match;
      })
      .filter((match) => match.score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
  }, [activeVector, circles, threshold]);

  const nodes = useMemo(() => {
    if (!activeMode || !activeVector) return [] as GraphNodeData[];
    const built: GraphNodeData[] = [
      {
        id: 'self',
        label: activeMode.name,
        caption: 'active travel mode',
        score: 100,
        reasons: [],
        kind: 'self',
        position: [0, 0, 0],
      },
    ];

    if (showInterests) {
      activeVector.interests.slice(0, 12).forEach((interest, index, all) => {
        built.push({
          id: `interest:${interest.name.toLocaleLowerCase()}`,
          label: interest.name,
          caption: `weight ${interest.weight}/5`,
          score: interest.weight * 20,
          reasons: [],
          kind: 'interest',
          position: ringPosition(index, all.length, 2.7, 0.15),
        });
      });
    }

    if (showPeople) {
      peopleMatches.forEach((match, index) => {
        built.push({
          ...match,
          kind: 'person',
          position: ringPosition(index, peopleMatches.length, 4.8, 0.55),
        });
      });
    }

    if (showCircles) {
      circleMatches.forEach((match, index) => {
        built.push({
          ...match,
          kind: 'circle',
          position: ringPosition(index, circleMatches.length, 6.7, 1.0),
        });
      });
    }

    return built;
  }, [activeMode, activeVector, circleMatches, peopleMatches, showCircles, showInterests, showPeople]);

  useEffect(() => {
    if (nodes.some((node) => node.id === selectedNodeId)) return;
    setSelectedNodeId('self');
  }, [nodes, selectedNodeId]);

  const selectedNode = nodes.find((node) => node.id === selectedNodeId) ?? nodes[0] ?? null;

  async function createCircleFromMode() {
    if (!client || !user || !activeMode || !activeVector || circleName.trim().length < 3) return;
    setCreatingCircle(true);
    setNotice('');
    setLoadError('');
    try {
      const { error } = await client.from('circles').insert({
        host_id: user.id,
        name: circleName.trim(),
        description: `Created from the ${activeMode.name} travel mode in dope.travel Constellation.`,
        destination: activeMode.destination,
        departure_city: activeMode.origin_city,
        start_date: activeMode.start_date,
        end_date: activeMode.end_date,
        capacity: 8,
        tags: activeVector.interests.map((interest) => interest.name),
        party_type: activeMode.party_type,
      });
      if (error) throw error;
      setNotice('Circle created. It is now part of the graph and ready for members to request access.');
      await loadData();
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Circle could not be created.');
    } finally {
      setCreatingCircle(false);
    }
  }

  return (
    <PlatformShell
      eyebrow="People graph · live context"
      title="Find your people for this trip."
      description="Switch travel modes and watch the graph reorganize around the version of you that is actually taking this trip."
    >
      {!user ? (
        <div className={communityStyles.grid}>
          <SignInCard />
          <aside className={communityStyles.card}>
            <span className={communityStyles.eyebrow}>Private by design</span>
            <h2>Constellation uses opt-in member context.</h2>
            <p className={communityStyles.muted}>
              dope.travel does not create fake people to make the network look busy. Sign in to create a travel mode and see real discoverable overlap as the network grows.
            </p>
          </aside>
        </div>
      ) : loading && modes.length === 0 ? (
        <div className={styles.empty}>
          <h2>Mapping your constellation…</h2>
          <p>Loading travel modes, discoverable members and circles.</p>
        </div>
      ) : loadError && ownModes.length === 0 ? (
        <div className={styles.empty}>
          <h2>Affinity graph is not connected yet.</h2>
          <p>{loadError}</p>
          <a className={communityStyles.button} href="/account">
            Open your profile
          </a>
        </div>
      ) : ownModes.length === 0 ? (
        <div className={styles.empty}>
          <h2>Create your first travel mode.</h2>
          <p>
            Start with something concrete: Family Ski, Solo Weekend, Work Layover or whatever version of you is taking the next trip.
          </p>
          <a className={communityStyles.button} href="/account">
            Create a travel mode
          </a>
        </div>
      ) : (
        <div className={styles.workspace}>
          <section className={styles.panel}>
            <div className={styles.controlGroup}>
              <span className={styles.label}>Travel lens</span>
              <select
                className={styles.modeSelect}
                value={selectedModeId}
                onChange={(event) => setSelectedModeId(event.target.value)}
              >
                {ownModes.map((mode) => (
                  <option key={mode.id} value={mode.id}>
                    {mode.name}
                  </option>
                ))}
              </select>
              {activeMode?.description && (
                <p className={communityStyles.small}>{activeMode.description}</p>
              )}
            </div>

            <div className={styles.controlGroup}>
              <div className={styles.toggle}>
                <span>Minimum affinity</span>
                <strong>{threshold}</strong>
              </div>
              <input
                className={styles.range}
                type="range"
                min="0"
                max="80"
                step="5"
                value={threshold}
                onChange={(event) => setThreshold(Number(event.target.value))}
              />
              <span className={communityStyles.small}>
                Raise this to collapse the graph around stronger overlap.
              </span>
            </div>

            <div className={styles.controlGroup}>
              <label className={styles.toggle}>
                Interests
                <input
                  type="checkbox"
                  checked={showInterests}
                  onChange={(event) => setShowInterests(event.target.checked)}
                />
              </label>
              <label className={styles.toggle}>
                People
                <input
                  type="checkbox"
                  checked={showPeople}
                  onChange={(event) => setShowPeople(event.target.checked)}
                />
              </label>
              <label className={styles.toggle}>
                Circles
                <input
                  type="checkbox"
                  checked={showCircles}
                  onChange={(event) => setShowCircles(event.target.checked)}
                />
              </label>
              <div className={styles.legend}>
                {(Object.keys(NODE_COLOR) as NodeKind[]).map((kind) => (
                  <div key={kind} className={styles.legendRow}>
                    <span className={styles.dot} style={{ color: NODE_COLOR[kind], background: NODE_COLOR[kind] }} />
                    {kind === 'self' ? 'active mode' : kind}
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.controlGroup}>
              <span className={styles.label}>Start a circle from this lens</span>
              <input
                className={styles.textInput}
                value={circleName}
                maxLength={100}
                onChange={(event) => setCircleName(event.target.value)}
              />
              <button
                className={styles.action}
                disabled={creatingCircle || circleName.trim().length < 3}
                onClick={() => void createCircleFromMode()}
              >
                {creatingCircle ? 'Creating…' : 'Create this circle'}
              </button>
              <a className={`${styles.action} ${styles.quietAction}`} href="/account">
                Edit travel modes
              </a>
              {notice && <p className={styles.notice}>{notice}</p>}
              {loadError && <p className={`${styles.notice} ${styles.error}`}>{loadError}</p>}
            </div>
          </section>

          <section className={styles.canvasShell} aria-label="Interactive travel affinity graph">
            <div className={styles.canvasMeta}>
              <strong>{activeMode?.name}</strong>
              <span>
                {peopleMatches.length} people · {circleMatches.length} circles · rotate to explore
              </span>
            </div>
            <Canvas camera={{ position: [0, 5.5, 11.5], fov: 48 }} dpr={[1, 1.7]}>
              <GraphScene
                nodes={nodes}
                selectedId={selectedNodeId}
                onSelect={(node) => setSelectedNodeId(node.id)}
              />
            </Canvas>
          </section>

          <aside className={`${styles.panel} ${styles.details}`}>
            <span className={styles.label}>Selected node</span>
            {selectedNode ? (
              <>
                <h2 className="font-display mt-3 text-[32px] leading-tight text-ink">
                  {selectedNode.label}
                </h2>
                <p className={communityStyles.muted}>{selectedNode.caption}</p>
                {selectedNode.kind !== 'self' && selectedNode.kind !== 'interest' && (
                  <>
                    <p className={styles.score}>{selectedNode.score}</p>
                    <span className={styles.label}>Affinity / 100</span>
                  </>
                )}
                {selectedNode.kind === 'interest' && (
                  <>
                    <p className={styles.score}>{Math.round(selectedNode.score / 20)}</p>
                    <span className={styles.label}>Interest weight / 5</span>
                  </>
                )}
                {selectedNode.reasons.length > 0 ? (
                  <ul className={styles.reasonList}>
                    {selectedNode.reasons.map((reason) => (
                      <li key={`${reason.kind}-${reason.label}`}>
                        <span>{reason.label}</span>
                        <code>+{Math.round(reason.points)}</code>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={communityStyles.small}>
                    {selectedNode.kind === 'self'
                      ? 'This is the active context. Everything else in the graph is measured against it.'
                      : 'This node is part of the active context rather than a match result.'}
                  </p>
                )}
                {selectedNode.kind === 'circle' && (
                  <a className={`${styles.action} ${styles.quietAction}`} href="/community">
                    Open travel circles
                  </a>
                )}
              </>
            ) : (
              <p className={communityStyles.muted}>Select a node to inspect the relationship.</p>
            )}
          </aside>
        </div>
      )}
    </PlatformShell>
  );
}
