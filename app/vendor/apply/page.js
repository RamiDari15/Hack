import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/supabase/server';
import { applyAsVendor } from '@/app/actions/marketplace';
import PageHead from '@/components/PageHead';
import VendorForm from '@/components/forms/VendorForm';

export const metadata = { title: 'Apply as a vendor' };

export default async function ApplyPage() {
  const { supabase, user } = await getSessionUser();
  if (!supabase) redirect('/dashboard');
  if (!user) redirect('/sign-in/vendor?next=/vendor/apply');
  return (
    <div className="page wrap-narrow">
      <PageHead back={{ href: '/vendor', label: 'Vendor dashboard' }} title="Apply as a vendor." lede="Tell us about your business. A person on the Vendora team reviews it, and your profile goes live once it is verified." />
      <div className="panel"><VendorForm action={applyAsVendor} apply initial={{ email: user.email ?? '' }} /></div>
    </div>
  );
}
