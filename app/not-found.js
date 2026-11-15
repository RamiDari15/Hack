import Link from 'next/link';
import PageHead from '@/components/PageHead';
export default function NotFound() {
  return (
    <div className="page wrap-narrow">
      <PageHead title="This page isn’t on the run of show." lede="It may have moved, or the link may be wrong.">
        <Link className="btn" href="/">Back to home</Link>
        <Link className="btn btn-outline" href="/vendors">Browse vendors</Link>
      </PageHead>
    </div>
  );
}
