'use client';

import { useState } from 'react';

/** The MCP address with a copy button (UFR2-H11). Falls back to selecting the text when the clipboard is blocked. */
export function CopyAddress({ url }: { url: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'select'>('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('select');
      const node = document.getElementById('mcp-address');
      const selection = window.getSelection();
      if (node && selection) {
        const range = document.createRange();
        range.selectNodeContents(node);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }

  return (
    <div className="mt-3 flex max-w-[680px] flex-wrap items-center gap-3">
      <code
        id="mcp-address"
        className="min-w-0 flex-1 select-all break-all rounded-[12px] bg-surface-2 px-4 py-3 font-mono text-[14px] text-ink"
        style={{ minHeight: 44 }}
      >
        {url}
      </code>
      <button type="button" className="btn btn-primary" onClick={copy} aria-live="polite">
        {state === 'copied' ? 'Copied ✓' : 'Copy address'}
      </button>
      {state === 'select' ? <p className="w-full text-[13px] text-ink-muted">Your browser blocked copying; the address is selected, so press Copy.</p> : null}
    </div>
  );
}
