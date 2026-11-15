'use client';

import { useActionState, useEffect, useRef } from 'react';

// A small form wrapper around a server action that returns { ok, message, error }.
// Children are plain inputs; the status line is announced politely.
export default function ActionForm({ action, children, className = 'stack', resetOnOk = false, id }) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef(null);
  useEffect(() => { if (resetOnOk && state?.ok) ref.current?.reset(); }, [state, resetOnOk]);
  return (
    <form ref={ref} id={id} action={formAction} className={className} data-pending={pending ? 'true' : undefined} aria-busy={pending}>
      {children}
      <div aria-live="polite">
        {state?.error && <p className="notice notice-error" role="alert">{state.error}</p>}
        {state?.ok && state.message && <p className="notice notice-ok">{state.message}</p>}
      </div>
    </form>
  );
}
