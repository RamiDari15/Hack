'use server';
import { revalidatePath } from 'next/cache';
import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/format';
import { EVENT_TYPES } from '@/lib/categories';
import { readBudgetOption, planningSelection, publishedOption } from '@/lib/vendor-pricing';
const text = (v, n) => typeof v === 'string' ? v.trim().slice(0,n) : '';

export async function saveVendor(_previous, fd) {
  const { supabase, user } = await getSessionUser();
  const vendor = text(fd.get('vendor_id'),36);
  if (!supabase || !user) return { error: 'Sign in to save vendors.' };
  if (!UUID_RE.test(vendor)) return { error: 'Vendor not found.' };
  const saved = fd.get('save') === 'yes';
  const result = saved ? await supabase.from('saved_vendors').upsert({user_id:user.id,vendor_id:vendor},{onConflict:'user_id,vendor_id',ignoreDuplicates:true})
    : await supabase.from('saved_vendors').delete().eq('user_id',user.id).eq('vendor_id',vendor);
  if (result.error) return {error:'Could not update saved vendors. Please try again.'};
  revalidatePath('/vendors'); revalidatePath('/saved'); revalidatePath(`/vendors/${vendor}`);
  return {ok:true,saved,message:saved?'Saved for later.':'Removed from saved vendors.'};
}

export async function planVendor(_previous, fd) {
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) return {error:'Sign in to add vendors to your events.'};
  const vendor=text(fd.get('vendor_id'),36), event=text(fd.get('event_id'),36);
  if (!UUID_RE.test(vendor) || (event!=='new' && !UUID_RE.test(event))) return {error:'Choose a vendor and event.'};
  let pricing=null;
  const choice=text(fd.get('pricing_title'),120);
  if(choice){
    const {data,error}=await supabase.from('vendor_packages').select('description').eq('vendor_id',vendor);
    if(error)return {error:'Could not load pricing. Try again.'};
    const option=(data||[]).map(p=>readBudgetOption(p.description)).find(p=>p?.title===choice);
    pricing=option && planningSelection(option,Number(fd.get('quantity')));
    if(!pricing)return {error:'Choose a valid pricing option and quantity.'};
  }
  const published=text(fd.get('published_package_id'),36);
  if(published){
    if(choice||!UUID_RE.test(published))return {error:'Choose one pricing option.'};
    const {data}=await supabase.from('vendor_packages').select('title,price_cents,description').eq('id',published).eq('vendor_id',vendor).maybeSingle();
    const option=data&&publishedOption(data);const selection=option&&planningSelection(option,Number(fd.get('quantity')));
    if(!selection)return {error:'That published option could not be priced. Check the quantity.'};
    pricing={...selection,source:'published'};
  }
  const details={};
  if(event==='new'){
    details.title=text(fd.get('title'),140); details.event_type=text(fd.get('event_type'),40);
    details.event_date=text(fd.get('event_date'),10); details.location=text(fd.get('location'),160);
    const guests=Number(fd.get('guest_count')||0), dollars=Number(fd.get('budget')||0);
    if(!details.title)return {error:'Give your new event a name.'};
    if(!EVENT_TYPES.includes(details.event_type))return {error:'Choose an event type.'};
    if(details.event_date && (!/^\d{4}-\d{2}-\d{2}$/.test(details.event_date)||Number.isNaN(Date.parse(details.event_date))))return {error:'Enter a valid event date.'};
    if(!Number.isInteger(guests)||guests<0||guests>100000||!Number.isFinite(dollars)||dollars<0||dollars>1000000)return {error:'Check the guest count and budget.'};
    details.guest_count=guests||null; details.budget_cents=fd.get('budget') ? Math.round(dollars*100):null;
  }
  const {data,error}=await supabase.rpc('plan_vendor',{p_vendor:vendor,p_event:event==='new'?null:event,p_details:details,p_pricing:pricing});
  if(error)return {error:'Could not add this vendor. Choose an event you can access and try again.'};
  for(const path of ['/dashboard',`/events/${data.event_id}`,`/events/${data.event_id}/shortlist`,`/events/${data.event_id}/package`])revalidatePath(path);
  return {ok:true,eventId:data.event_id,message:event==='new'?'Event created and vendor added.':'Vendor added to your event.',href:`/events/${data.event_id}/shortlist`};
}
