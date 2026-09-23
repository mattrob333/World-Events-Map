import { buildPrivateSkiBrief, buildPublicSkiCircle, type FamilySkiInput } from './familySki';

type PublicCircle = ReturnType<typeof buildPublicSkiCircle>;

export interface CircleCreationSteps {
  createCircle(publicCircle: PublicCircle): Promise<string>;
  verifyOwner(): Promise<boolean>;
  savePrivateBrief(circleId: string, brief: string): Promise<void>;
  isCurrent(): boolean;
}

export type CircleCreationOutcome =
  | { kind: 'created'; circleId: string }
  | { kind: 'brief-failed'; circleId: string; brief: string }
  | { kind: 'failed'; error: unknown }
  | { kind: 'stale' };

/** Keep private trip details out of writes and UI completions after an auth switch. */
export async function createFamilySkiCircle(
  input: FamilySkiInput,
  hostId: string,
  steps: CircleCreationSteps,
): Promise<CircleCreationOutcome> {
  if (!steps.isCurrent()) return { kind: 'stale' };
  let circleId: string;
  try {
    circleId = await steps.createCircle(buildPublicSkiCircle(input, hostId));
  } catch (error) {
    return steps.isCurrent() ? { kind: 'failed', error } : { kind: 'stale' };
  }
  if (!steps.isCurrent()) return { kind: 'stale' };

  // The host may sign out in another tab while the first network call runs.
  // Recheck the provider's current identity before submitting the private brief.
  try {
    const sameOwner = await steps.verifyOwner();
    if (!sameOwner || !steps.isCurrent()) return { kind: 'stale' };
  } catch {
    return { kind: 'stale' };
  }

  const brief = buildPrivateSkiBrief(input);
  try {
    await steps.savePrivateBrief(circleId, brief);
  } catch {
    return steps.isCurrent() ? { kind: 'brief-failed', circleId, brief } : { kind: 'stale' };
  }
  return steps.isCurrent() ? { kind: 'created', circleId } : { kind: 'stale' };
}
