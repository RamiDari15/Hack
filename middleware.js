import { updateSession } from './lib/supabase/middleware';

export async function middleware(request) {
  return updateSession(request);
}

export const config = {
  // Skip static files and images.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'],
};
