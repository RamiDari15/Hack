export function DemoRating({ reviews = [] }) {
  if (!reviews.length) return null;
  const rating = (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1);
  return <p className="small demo-rating"><span aria-hidden="true">★</span> {rating} / 5 · {reviews.length} simulated reviews</p>;
}

export default function VendorReviews({ reviews = [], googleReviewsUrl, sourceUrl }) {
  return <section className="stack" aria-labelledby="reviews-title">
    <div className="between"><h2 id="reviews-title" className="display-3">Reviews</h2>{reviews.length > 0 && <span className="badge badge-warn">Simulated</span>}</div>
    {googleReviewsUrl && <div className="row"><a className="small" href={googleReviewsUrl} target="_blank" rel="noopener noreferrer">Find Google reviews ↗</a>{sourceUrl && <a className="small" href={sourceUrl} target="_blank" rel="noopener noreferrer">View public listing feedback ↗</a>}</div>}
    {reviews.length > 0 ? <>
      <p className="small muted">Simulated ratings and fictional customer feedback for preview purposes.</p>
      <DemoRating reviews={reviews} />
      <details className="demo-review-details"><summary>Read {reviews.length} reviews</summary>
        <ul className="demo-review-list">{reviews.map((r) => <li key={r.id} className="stack-sm">
          <div className="between"><h3 className="small">{r.author}</h3><span className="small" aria-label={`${r.rating} out of 5 stars`}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span></div>
          <p className="small muted">{r.body}</p>
        </li>)}</ul>
      </details>
    </> : <p className="muted">No reviews yet. Reviews appear only from completed bookings.</p>}
  </section>;
}
