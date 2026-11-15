const LABELS = [
  ['badge-ok', 'Verified', 'A business we reviewed: its details, documents and service area. Only verified vendors can receive your inquiries.'],
  ['badge-warn', 'External, confirm', 'Found on the web by search and shown with its source. Check the price and availability with the business yourself.'],
  ['badge-warn', 'AI estimate', 'A range the planner worked out from your event details. It is a starting point, not a price.'],
  ['badge-accent', 'Vendor quote', 'The amount a vendor sent you for your date. It replaces the estimate in your budget.'],
];

export default function Labels() {
  return (
    <section className="labels" aria-labelledby="labels-title">
      <div className="wrap labels-grid">
        <div className="stack-lg labels-head">
          <h2 id="labels-title" className="display-1">Every number says where it came from.</h2>
          <p className="lede">Planning goes wrong when a guess looks like a promise. Vendora marks each listing and each amount with one of four labels, and keeps them the same on every page.</p>
        </div>
        <dl className="labels-list">
          {LABELS.map(([tone, name, text]) => (
            <div className="labels-row" key={name}>
              <dt><span className={`badge badge-lg ${tone}`}>{name}</span></dt>
              <dd>{text}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
