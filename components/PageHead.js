import Link from 'next/link';

// Top of every inner page: optional back link, a big title, an optional lede and actions.
export default function PageHead({ back, title, lede, children, size = 'display-2' }) {
  return (
    <header className="page-head">
      {back && <Link href={back.href} className="back-link">{back.label}</Link>}
      <h1 className={size}>{title}</h1>
      {lede && <p className="lede">{lede}</p>}
      {children && <div className="row page-actions">{children}</div>}
    </header>
  );
}
