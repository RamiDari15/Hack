import Link from 'next/link';
import Placeholder from '@/components/ui/Placeholder';
import Image from 'next/image';
import { moneyCents } from '@/lib/format';
import { DemoRating } from '@/components/VendorReviews';

export function VerificationBadge({ vendor }) {
  if (vendor.directoryListed) return <span className="badge">Public listing</span>;
  if (vendor.verification === 'verified') return <span className="badge badge-ok">Verified</span>;
  return <span className="badge badge-warn">Verification pending</span>;
}

export default function VendorCard({ vendor, index = 0 }) {
  const priced = (vendor.packages ?? []).map((p) => p.priceCents).filter((n) => n != null);
  const from = priced.length ? Math.min(...priced) : null;
  return (
    <Link href={`/vendors/${vendor.id}`} className="vendor-card">
      {vendor.photos?.[0] ? <div className="vendor-photo"><Image src={vendor.photos[0]} alt={`${vendor.name} portfolio`} fill sizes="(max-width: 760px) 100vw, 33vw" unoptimized /></div> : <Placeholder label={vendor.category} seed={index} />}
      <div className="vendor-card-body">
        <div className="between"><VerificationBadge vendor={vendor} /><span className="fine">{vendor.city}</span></div>
        <h3 className="title">{vendor.name}</h3>
        <DemoRating reviews={vendor.demoReviews} />
        <p className="small muted num">
          {vendor.directoryListed ? (vendor.packages?.length ? 'See published packages' : 'Contact for pricing') : from != null ? `From ${moneyCents(from)}` : 'Quote on request'}
          {vendor.serviceRadiusMi ? `, travels ${vendor.serviceRadiusMi} mi` : ''}
        </p>
      </div>
    </Link>
  );
}
