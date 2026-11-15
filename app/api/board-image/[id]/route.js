import { getSessionUser } from '@/lib/supabase/server';
import { UUID_RE } from '@/lib/format';

// Serves an uploaded style-board photo. Row-level security decides who can read it.
export async function GET(_req, { params }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) return new Response('Not found', { status: 404 });
  const { supabase, user } = await getSessionUser();
  if (!supabase || !user) return new Response('Not found', { status: 404 });
  const { data } = await supabase.from('style_board_items').select('image_data').eq('id', id).maybeSingle();
  const m = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/.exec(data?.image_data ?? '');
  if (!m) return new Response('Not found', { status: 404 });
  return new Response(Buffer.from(m[2], 'base64'), {
    headers: { 'Content-Type': m[1], 'Cache-Control': 'private, max-age=3600', 'Content-Security-Policy': "default-src 'none'" },
  });
}
