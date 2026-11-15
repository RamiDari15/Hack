'use client';

import { useEffect, useRef, useState } from 'react';
import Placeholder from './Placeholder';

// Shows the listing's photo; if the image host fails, falls back to the colour block instead of a broken image.
export default function VendorPhoto({ src, alt, label, seed }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef(null);
  // An image can fail before hydration, when onError isn't attached yet; catch that after mount.
  useEffect(() => { const i = ref.current; if (i && i.complete && !i.naturalWidth) setFailed(true); }, []);
  if (!src || failed) return <Placeholder label={label} seed={seed} caption={failed ? 'Photo unavailable' : 'No photos yet'} />;
  return (
    <div className="vendor-photo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={ref} src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    </div>
  );
}
