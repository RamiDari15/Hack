import SaveVendorButton from '@/components/SaveVendorButton';
import VendorEventActions from '@/components/VendorEventActions';
import Link from 'next/link';
import VendorPhoto from '@/components/ui/VendorPhoto';
import { moneyCents } from '@/lib/format';

export function VerificationBadge({ vendor }) {
  if (vendor.calendarIsDemo && !vendor.directoryListed) return <span className="badge">Private sample business</span>;
  if (vendor.directoryListed) return <span className="badge">Public listing</span>;
  if (vendor.verification === 'verified') return <span className="badge badge-ok">Verified</span>;
  return <span className="badge badge-warn">Verification pending</span>;
}

export default function VendorCard({ vendor, index = 0, showDistance = false, events = [], signedIn = false, saved = false, eventId = '' }) {
  const priced = (vendor.packages ?? []).map((p) => p.priceCents).filter((n) => n != null);
  const from = priced.length ? Math.min(...priced) : null;
  return (
    <article className="vendor-card"><Link href={`/vendors/${vendor.id}${eventId?`?event=${eventId}`:''}`} className="vendor-card-link" data-cursor="View">
      <VendorPhoto src={vendor.photos?.[0]} alt={`${vendor.name} portfolio`} label={vendor.category} seed={index} />
      <div className="vendor-card-body">
        <div className="between"><VerificationBadge vendor={vendor} /><span className="fine">{vendor.city}{showDistance && vendor.distanceMi != null ? `, ${vendor.distanceMi} mi` : ''}</span></div>
        <h3 className="title">{vendor.name}</h3>
        <p className="small muted num">
          {vendor.lowestPrice ? `Published from ${moneyCents(vendor.lowestPrice.cents)}${vendor.lowestPrice.unit !== 'event' ? ` / ${vendor.lowestPrice.unit}` : ''}`
            : vendor.directoryListed ? (vendor.budgetOptions?.length ? 'Explore pricing options' : 'Contact for pricing') : from != null ? `From ${moneyCents(from)}` : 'Quote on request'}
          {vendor.serviceRadiusMi ? `, travels ${vendor.serviceRadiusMi} mi` : ''}
        </p>
      </div>
    </Link><div className="vendor-card-planning"><SaveVendorButton vendorId={vendor.id} saved={saved} signedIn={signedIn}/><VendorEventActions vendorId={vendor.id} events={events} signedIn={signedIn} eventId={eventId} compact/></div></article>
  );
}
