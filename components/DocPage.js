import PageHead from './PageHead';

export default function DocPage({ title, lede, children }) {
  return (
    <div className="page wrap-narrow">
      <PageHead title={title} lede={lede} />
      <div className="prose">{children}</div>
    </div>
  );
}
