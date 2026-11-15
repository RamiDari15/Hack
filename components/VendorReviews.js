// Reviews come only from completed bookings. Real listings link out to where their reviews live.
export default function VendorReviews({ googleReviewsUrl, sourceUrl }) {
  return <section className="stack" aria-labelledby="reviews-title">
    <h2 id="reviews-title" className="display-3">Reviews</h2>
    {googleReviewsUrl && <div className="row"><a className="small" href={googleReviewsUrl} target="_blank" rel="noopener noreferrer">Find Google reviews ↗</a>{sourceUrl && <a className="small" href={sourceUrl} target="_blank" rel="noopener noreferrer">View public listing feedback ↗</a>}</div>}
    <p className="muted">No reviews on Vendora yet. Reviews appear only from completed bookings.</p>
  </section>;
}
