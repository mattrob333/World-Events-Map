import { expect, it } from 'vitest';
import { RequestGate } from './requestGate';

it('does not let a late response from circle A replace circle B', async () => {
  const gate = new RequestGate();
  let displayed = '';
  let finishA!: () => void;
  const isA = gate.begin();
  const a = new Promise<void>((resolve) => {
    finishA = resolve;
  }).then(() => {
    if (isA()) displayed = 'A';
  });
  gate.invalidate();
  const isB = gate.begin();
  await Promise.resolve().then(() => {
    if (isB()) displayed = 'B';
  });
  finishA();
  await a;
  expect(displayed).toBe('B');
});

it('invalidates pending member data when closing a circle or ending a session', () => {
  const gate = new RequestGate();
  const active = gate.begin();
  gate.invalidate();
  expect(active()).toBe(false);
});
