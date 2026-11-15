'use client';

import { startTransition, useActionState, useRef, useState } from 'react';
import { addBoardItem } from '@/app/actions/shared';

// Adds a photo (resized in the browser to at most 1400 px, JPEG) or an image link to the board.
async function resize(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (const q of [0.82, 0.7, 0.55, 0.4]) {
    const url = canvas.toDataURL('image/jpeg', q);
    if (url.length <= 680000) return url;
  }
  return null;
}

export default function AddToBoard({ eventId, section, sections }) {
  const [state, action, pending] = useActionState(addBoardItem, null);
  const [prep, setPrep] = useState('');
  const form = useRef(null);
  async function submit(e) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get('photo');
    fd.delete('photo');
    if (file && file.size) {
      if (!/^image\//.test(file.type) || file.size > 10 * 1024 * 1024) { setPrep('Choose an image under 10 MB.'); return; }
      setPrep('Preparing photo…');
      const data = await resize(file).catch(() => null);
      if (!data) { setPrep('That photo could not be read. Try a JPEG or PNG.'); return; }
      fd.set('image_data', data);
      fd.delete('image_url');
    }
    setPrep('');
    startTransition(() => action(fd));
    form.current?.reset();
  }
  return (
    <form ref={form} onSubmit={submit} className="stack" aria-busy={pending}>
      <input type="hidden" name="event_id" value={eventId} />
      <div className="field"><label htmlFor="bd-section">Section</label>
        <select id="bd-section" name="section" defaultValue={section}>{sections.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></div>
      <div className="field"><label htmlFor="bd-photo">Upload a photo</label><input id="bd-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" /></div>
      <div className="field"><label htmlFor="bd-url">Or paste an image link (https)</label><input id="bd-url" name="image_url" type="url" placeholder="https://" maxLength={2000} /></div>
      <div className="field"><label htmlFor="bd-caption">Caption (optional)</label><input id="bd-caption" name="caption" maxLength={200} /></div>
      <button className="btn" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Add to board'}</button>
      <div aria-live="polite">
        {prep && <p className="small muted">{prep}</p>}
        {state?.error && <p className="notice notice-error" role="alert">{state.error}</p>}
        {state?.ok && <p className="notice notice-ok">{state.message}</p>}
      </div>
      <p className="fine">Only add photos you took or links you’re allowed to share. The board is private to people on this event.</p>
    </form>
  );
}
