'use client';
import Link from 'next/link';
import { useActionState } from 'react';
import { saveVendor } from '@/app/actions/vendor-planning';
export default function SaveVendorButton({vendorId,saved=false,signedIn=false}){
 const [state,action,pending]=useActionState(saveVendor,null);
 const current=state?.saved??saved;
 if(!signedIn)return <Link className="btn btn-sm btn-outline" href={`/sign-in?next=/vendors/${vendorId}`}>♡ Save for later</Link>;
 return <form action={action} className="save-vendor-form"><input type="hidden" name="vendor_id" value={vendorId}/><input type="hidden" name="save" value={current?'no':'yes'}/>
  <button className={`btn btn-sm btn-outline${current?' is-saved':''}`} disabled={pending} aria-pressed={current}>{pending?'Saving…':current?'♥ Saved for later':'♡ Save for later'}</button>
  <span className={state?.error?'fine text-danger':'sr-only'} role="status">{state?.error||state?.message}</span></form>;
}
