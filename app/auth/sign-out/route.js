import { isFirebaseConfigured } from '@/lib/firebase/config';
import { clearFirebaseCookies } from '@/lib/firebase/cookies';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST only, so a link or prefetch can never sign someone out.
export async function POST(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return new NextResponse('Invalid origin', { status: 403 });
  if (isFirebaseConfigured) {
    const response = NextResponse.redirect(new URL('/', request.url), { status: 303 });
    clearFirebaseCookies(response, new URL(request.url).protocol === 'https:');
    return response;
  }
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/', request.url), { status: 303 });
}
