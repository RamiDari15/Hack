import { money, moneyCents } from '@/lib/format';

// AI estimates and vendor quotes in one table, labeled differently.
// A quote replaces the estimate for its category when the vendor category matches the row name.
export default function BudgetTable({ categories, quotes = [] }) {
  const used = new Set();
  const rows = categories.map((c) => {
    const q = quotes.find((x) => !used.has(x.id) && x.vendor?.category && c.name.toLowerCase().includes(x.vendor.category.toLowerCase().split(' ')[0]));
    if (q) used.add(q.id);
    return { ...c, quote: q };
  });
  const extra = quotes.filter((q) => !used.has(q.id));
  const low = rows.reduce((s, r) => s + (r.quote ? r.quote.amount_cents / 100 : r.low), 0) + extra.reduce((s, q) => s + q.amount_cents / 100, 0);
  const high = rows.reduce((s, r) => s + (r.quote ? r.quote.amount_cents / 100 : r.high), 0) + extra.reduce((s, q) => s + q.amount_cents / 100, 0);

  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="sr-only">Budget by category, AI ballparks and vendor quotes</caption>
        <thead><tr><th scope="col">Category</th><th scope="col">Source</th><th scope="col" className="num">Amount</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td>{r.name}{r.notes ? <div className="fine">{r.notes}</div> : null}</td>
              <td><span className={`source${r.quote ? ' is-quote' : ''}`}>{r.quote ? 'Vendor quote' : 'Ballpark'}</span></td>
              <td className="num">{r.quote ? moneyCents(r.quote.amount_cents) : `${money(r.low)} – ${money(r.high)}`}</td>
            </tr>
          ))}
          {extra.map((q) => (
            <tr key={q.id}><td>{q.vendor?.name}</td><td><span className="source is-quote">Vendor quote</span></td><td className="num">{moneyCents(q.amount_cents)}</td></tr>
          ))}
        </tbody>
        <tfoot><tr><td colSpan={2}>Total</td><td className="num">{low === high ? money(low) : `${money(low)} – ${money(high)}`}</td></tr></tfoot>
      </table>
    </div>
  );
}
