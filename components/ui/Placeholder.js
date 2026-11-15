// Stand-in for vendor photos until real portfolios are uploaded. Says so in its caption.
// A colour block with a couple of loose shapes, varied by seed so a grid of them doesn't repeat.
const PALETTES = [
  ['var(--sun)', 'var(--pink)', 'var(--cream)'],
  ['var(--pink-2)', 'var(--sun)', 'var(--paper)'],
  ['var(--sun-2)', 'var(--ink)', 'var(--pink-2)'],
  ['var(--pink-soft)', 'var(--pink)', 'var(--sun)'],
  ['var(--cream-3)', 'var(--sun)', 'var(--pink)'],
];

export default function Placeholder({ label, caption = 'No photos yet', ratio = '4 / 3', seed = 0 }) {
  const n = Math.abs(Number(seed) || 0);
  const [bg, a, b] = PALETTES[n % PALETTES.length];
  const variant = n % 3;
  return (
    <figure className={`ph ph-v${variant}`} style={{ aspectRatio: ratio, '--ph-bg': bg, '--ph-a': a, '--ph-b': b }}>
      <svg viewBox="0 0 100 75" preserveAspectRatio="xMidYMid slice" aria-hidden="true" className="ph-shapes">
        {variant === 0 && <>
          <circle cx="78" cy="22" r="20" fill="var(--ph-a)" />
          <path d="M-5 75 Q 30 30 62 58 T 110 50 V 80 H -5Z" fill="var(--ph-b)" />
        </>}
        {variant === 1 && <>
          <rect x="54" y="-10" width="40" height="62" rx="20" fill="var(--ph-a)" transform="rotate(18 74 21)" />
          <circle cx="18" cy="64" r="22" fill="var(--ph-b)" />
        </>}
        {variant === 2 && <>
          <path d="M70 8 l5 13 13 5 -13 5 -5 13 -5 -13 -13 -5 13 -5z" fill="var(--ph-a)" />
          <rect x="-8" y="48" width="70" height="40" rx="20" fill="var(--ph-b)" />
        </>}
      </svg>
      {label && <span className="ph-label">{label}</span>}
      {caption && <figcaption className="ph-cap">{caption}</figcaption>}
    </figure>
  );
}
