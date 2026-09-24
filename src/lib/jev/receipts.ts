import 'server-only';

import { signalDatabase } from '@/lib/data/durable';
import type { DecisionReceipt } from './client';

/** Best-effort receipt storage. A missing table or database never breaks the user's request. */
export async function storeReceipts(receipts: DecisionReceipt[]): Promise<void> {
  const db = signalDatabase();
  if (!db || !receipts.length) return;
  try {
    await db.from('jev_decisions').insert(receipts.map((receipt) => ({
      contract: receipt.contract,
      subject: receipt.subject,
      state_hash: receipt.stateHash,
      model: receipt.model,
      latency_ms: receipt.latencyMs,
      answers: receipt.answers,
      failure: receipt.failure,
      route: receipt.route,
      action_taken: receipt.actionTaken,
      created_at: receipt.createdAt,
    })));
  } catch {
    // Receipts are for calibration; the request already has its answer.
  }
}
