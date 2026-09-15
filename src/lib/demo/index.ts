import { isDemoMode } from '@/lib/flags';
import { MEMBERS, YOU, type MemberDossier } from '@/lib/social/members';
import { getSimulation, type SimulatedWorld } from '@/lib/social/simulation';

export { isDemoMode as isDemo } from '@/lib/flags';

export interface DemoWorld extends SimulatedWorld {
  /** The local profile's initial identity. Edits remain in the social store. */
  currentMember: MemberDossier;
  /** Includes the current user; peer consumers must exclude that identity. */
  members: readonly MemberDossier[];
  memberIndex: ReadonlyMap<string, MemberDossier>;
}

let emptyWorld: DemoWorld | undefined;
const worlds = new WeakMap<SimulatedWorld, DemoWorld>();

/**
 * The only boundary that admits generated social data. Threads, presence and
 * activity are derived from this world's groups, peers and signals by their
 * existing modules; an empty world cannot seed any of those surfaces.
 *
 * No browser state or wall clock is read here. The empty world is lazy so the
 * generators may import the gate without accessing an uninitialised roster.
 */
export function getDemoWorld(): DemoWorld {
  if (!isDemoMode()) {
    return (emptyWorld ??= {
      currentMember: YOU,
      members: [YOU],
      memberIndex: new Map([[YOU.id, YOU]]),
      signals: [],
      signalsByEvent: new Map(),
      peerCounts: Object.freeze({}),
      groups: [],
      groupsByEvent: new Map(),
      dripQueue: [],
    });
  }

  const simulation = getSimulation();
  let world = worlds.get(simulation);
  if (!world) {
    const members = [YOU, ...MEMBERS];
    world = {
      ...simulation,
      peerCounts: Object.freeze({ ...simulation.peerCounts }),
      currentMember: YOU,
      members,
      memberIndex: new Map(members.map((member) => [member.id, member])),
    };
    worlds.set(simulation, world);
  }
  return world;
}
