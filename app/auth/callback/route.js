import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/supabase/config';

// OAuth (Google, SSOJet) and email magic links return here with ?code=.
// The code is exchanged for a session cookie, then the user goes to ?next= (same-site only).
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));
  const providerError = searchParams.get('error_description') || searchParams.get('error');

  if (providerError) {
    return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent('Sign-in was cancelled or failed. Try again.')}&next=${encodeURIComponent(next)}`);
  }

  const supabase = await createClient();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent('That sign-in link is invalid or has expired. Request a new one.')}&next=${encodeURIComponent(next)}`);
}
