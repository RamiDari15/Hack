const LABELS = [
  ['badge-ok', 'Verified', 'We checked the business: its details, documents and service area.'],
  ['badge-plain', 'Listed', 'A public business listing. Check the price and the date with them.'],
  ['badge-warn', 'Ballpark', 'A range the planner worked out from your details. A starting point, not a price.'],
  ['badge-accent', 'Vendor quote', 'What a vendor actually sent you for your date. It replaces the ballpark.'],
];

export default function Labels() {
  return (
    <section className="labels" aria-labelledby="labels-title">
      <div className="wrap labels-grid">
        <div className="stack-lg labels-head" data-reveal>
          <h2 id="labels-title" className="display-1">Every price says where it <em>came from.</em></h2>
        </div>
        <dl className="labels-list">
          {LABELS.map(([tone, name, text], i) => (
            <div className="labels-row" key={name} data-reveal style={{ '--reveal-delay': `${i * 80}ms` }}>
              <dt className={`labels-name labels-${tone}`}>{name}</dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
