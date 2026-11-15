'use client';

export default function Error({ reset }) {
  return (
    <div className="page wrap-narrow" role="alert">
      <header className="page-head">
        <h1 className="display-2">This page didn’t load.</h1>
        <p className="lede">Try again. If it keeps happening, the service may be down for a moment.</p>
      </header>
      <button className="btn" type="button" onClick={() => reset()}>Try again</button>
    </div>
  );
}
