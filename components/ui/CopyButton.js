'use client';

import { useState } from 'react';

// Copies text (such as an RSVP link) and says so for screen readers too.
export default function CopyButton({ text, label = 'Copy link', className = 'btn btn-sm btn-outline' }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); } catch { setDone(false); }
  }
  return (
    <button type="button" className={className} onClick={copy} data-copy={text}>
      <span aria-live="polite">{done ? 'Copied' : label}</span>
    </button>
  );
}
