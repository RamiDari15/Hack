import SaveVendorButton from '@/components/SaveVendorButton';
import VendorEventActions from '@/components/VendorEventActions';
import Link from 'next/link';
import VendorPhoto from '@/components/ui/VendorPhoto';
import { moneyCents } from '@/lib/format';

export function VerificationBadge({ vendor }) {
  if (vendor.directoryListed) return <span className="badge">Public listing</span>;
  if (vendor.verification === 'verified') return <span className="badge badge-ok">Verified</span>;
  return <span className="badge badge-warn">Verification pending</span>;
}

// Editorial card: photo (or a quiet stand-in), name, category · city, one price line, one row of actions.
export default function VendorCard({ vendor, index = 0, showDistance = false, events = [], signedIn = false, saved = false, eventId = '' }) {
  const priced = (vendor.packages ?? []).map((p) => p.priceCents).filter((n) => n != null);
  const from = priced.length ? Math.min(...priced) : null;
  const city = vendor.city ? `${vendor.city}${showDistance && vendor.distanceMi != null ? `, ${vendor.distanceMi} mi` : ''}` : null;
  return (
    <article className="vendor-card"><Link href={`/vendors/${vendor.id}${eventId?`?event=${eventId}`:''}`} className="vendor-card-link">
      <VendorPhoto src={vendor.photos?.[0]} alt={`${vendor.name} portfolio`} label={vendor.category} seed={index} />
      <div className="vendor-card-body">
        <h3 className="title vendor-card-name">{vendor.name}</h3>
        <p className="vendor-card-meta"><span>{[vendor.category, city].filter(Boolean).join(' · ')}</span><VerificationBadge vendor={vendor} /></p>
        <p className="vendor-card-price">
          {vendor.lowestPrice ? `Published from ${moneyCents(vendor.lowestPrice.cents)}${vendor.lowestPrice.unit !== 'event' ? ` / ${vendor.lowestPrice.unit}` : ''}`
            : vendor.directoryListed ? (vendor.budgetOptions?.length ? 'Explore pricing options' : 'Contact for pricing') : from != null ? `From ${moneyCents(from)}` : 'Quote on request'}
          {vendor.serviceRadiusMi ? ` · travels ${vendor.serviceRadiusMi} mi` : ''}
        </p>
      </div>
    </Link><div className="vendor-card-planning"><SaveVendorButton vendorId={vendor.id} saved={saved} signedIn={signedIn}/><VendorEventActions vendorId={vendor.id} events={events} signedIn={signedIn} eventId={eventId} compact/></div></article>
  );
}
