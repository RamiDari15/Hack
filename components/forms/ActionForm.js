'use client';

import { startTransition, useActionState, useEffect, useRef } from 'react';

// A small form wrapper around a server action that returns { ok, message, error }.
// Children are plain inputs; the status line is announced politely.
// Submits through onSubmit so React does not reset the fields to their first-render defaults
// after the action: what the person entered stays visible (resetOnOk clears it when wanted).
export default function ActionForm({ action, children, className = 'stack', resetOnOk = false, id }) {
  const [state, formAction, pending] = useActionState(action, null);
  const ref = useRef(null);
  useEffect(() => { if (resetOnOk && state?.ok) ref.current?.reset(); }, [state, resetOnOk]);
  return (
    <form ref={ref} id={id} action={formAction} onSubmit={(e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget, e.nativeEvent.submitter);
      startTransition(() => formAction(fd));
    }} className={className} data-pending={pending ? 'true' : undefined} aria-busy={pending}>
      {children}
      <div aria-live="polite">
        {state?.error && <p className="notice notice-error" role="alert">{state.error}</p>}
        {state?.ok && state.message && <p className="notice notice-ok">{state.message}</p>}
      </div>
    </form>
  );
}
