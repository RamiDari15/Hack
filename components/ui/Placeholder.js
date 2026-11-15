// Stand-in for vendor photos until real portfolios are uploaded. Says so in its caption.
export default function Placeholder({ label, caption = 'No photos yet', ratio = '4 / 3', seed = 0 }) {
  const bulbs = Array.from({ length: 9 }, (_, i) => {
    const u = i / 8;
    return { x: 6 + u * 88, y: 16 + 14 * (1 - (2 * u - 1) ** 2) + ((i + seed) % 3) * .6 };
  });
  return (
    <figure className="ph on-dusk" style={{ aspectRatio: ratio }}>
      <svg viewBox="0 0 100 60" preserveAspectRatio="xMidYMin slice" aria-hidden="true" className="ph-lights">
        <path d={`M0 ${bulbs[0].y - 2} Q 50 ${44 + (seed % 4)} 100 ${bulbs[8].y - 2}`} fill="none" stroke="#54467a" strokeWidth=".5" />
        {bulbs.map((b, i) => <circle key={i} cx={b.x} cy={b.y} r="1.5" className="ph-bulb" />)}
      </svg>
      {label && <span className="ph-label">{label}</span>}
      {caption && <figcaption className="ph-cap">{caption}</figcaption>}
    </figure>
  );
}
