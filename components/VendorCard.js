import Link from 'next/link';
import Placeholder from '@/components/ui/Placeholder';
import { moneyCents } from '@/lib/format';

export function VerificationBadge({ vendor }) {
  if (vendor.sample) return <span className="badge">Sample</span>;
  if (vendor.verification === 'verified') return <span className="badge badge-ok">Verified</span>;
  return <span className="badge badge-warn">Verification pending</span>;
}

export default function VendorCard({ vendor, index = 0 }) {
  const priced = (vendor.packages ?? []).map((p) => p.priceCents).filter((n) => n != null);
  const from = priced.length ? Math.min(...priced) : null;
  return (
    <Link href={`/vendors/${vendor.id}`} className="vendor-card">
      <Placeholder label={vendor.category} caption={vendor.sample ? 'Sample listing, no photos' : 'No photos yet'} seed={index} />
      <div className="vendor-card-body">
        <div className="between"><VerificationBadge vendor={vendor} /><span className="fine">{vendor.city}</span></div>
        <h3 className="title">{vendor.name}</h3>
        <p className="small muted num">
          {from != null ? `From ${moneyCents(from)}${vendor.sample ? ' (sample)' : ''}` : 'Quote on request'}
          {vendor.serviceRadiusMi ? `, travels ${vendor.serviceRadiusMi} mi` : ''}
        </p>
      </div>
    </Link>
  );
}
