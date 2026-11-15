import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST only, so a link or prefetch can never sign someone out.
export async function POST(request) {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}
