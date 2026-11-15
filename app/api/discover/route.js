import { NextResponse } from 'next/server';
import { fetchWithTimeout, jsonError, readJson, requireUserWithinLimit } from '@/lib/api';

// Web discovery with OpenAI's built-in web search tool (Responses API). Server only.
// External results are returned separately from verified Vendora listings and are always
// marked as needing confirmation. A result is kept only if its site is one the search
// actually returned as a source or citation, so the model cannot invent a link.

const INSTRUCTIONS = `You find real businesses and venues on the web for event planning.
Search the web, then return up to 8 results that match the request.
Rules:
- Only include pages you found with web search. Use the page's real URL.
- The snippet says what the page offers, in one or two plain sentences, based on the page.
- Do not state prices, availability, ratings or capacity unless the page states them, and then say "the page lists".
- Never claim a business is verified, recommended or affiliated with Vendora.`;

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['results'],
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['title', 'url', 'snippet'],
        properties: { title: { type: 'string' }, url: { type: 'string' }, snippet: { type: 'string' } },
      },
    },
  },
};

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; } };

export async function POST(request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) return jsonError('Web search is not configured yet. Add OPENAI_API_KEY and OPENAI_MODEL.', 503);

  const gate = await requireUserWithinLimit();
  if (gate.error) return gate.error;
  const { supabase, user } = gate;

  const { body, error } = await readJson(request, 4000);
  if (error) return jsonError(error, 400);
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  if (!query || query.length > 300) return jsonError('Search with 1 to 300 characters.', 400);

  let res;
  try {
    res = await fetchWithTimeout(`${(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        instructions: INSTRUCTIONS,
        input: `Search request: ${query}`,
        tools: [{ type: 'web_search', user_location: { type: 'approximate', country: 'US' } }],
        include: ['web_search_call.action.sources'],
        max_output_tokens: 3000,
        store: false,
        text: { format: { type: 'json_schema', name: 'web_results', strict: true, schema: SCHEMA } },
      }),
    }, 60_000);
  } catch {
    return jsonError('Web search took too long. Try again.', 504);
  }
  if (!res.ok) {
    console.error('OpenAI web search error', res.status, (await res.text()).slice(0, 500));
    return jsonError('Web search is unavailable right now.', 502);
  }

  const out = await res.json();
  const items = out.output ?? [];
  // Sites the search really returned: the search call's sources plus any url citations.
  const seen = new Set();
  for (const o of items) {
    if (o.type === 'web_search_call') for (const s of o.action?.sources ?? []) { const h = hostOf(s.url); if (h) seen.add(h); }
    if (o.type === 'message') for (const c of o.content ?? []) for (const a of c.annotations ?? []) { if (a.type === 'url_citation') { const h = hostOf(a.url); if (h) seen.add(h); } }
  }
  const parts = items.filter((o) => o.type === 'message').flatMap((o) => o.content ?? []);
  if (parts.some((c) => c.type === 'refusal')) return jsonError('Web search could not help with that request. Try different words.', 422);
  const text = parts.filter((c) => c.type === 'output_text').map((c) => c.text).join('');
  if (!text) return jsonError('Web search returned nothing readable. Try again.', 502);

  let parsed;
  try { parsed = JSON.parse(text); } catch { return jsonError('Web search returned an unreadable answer. Try again.', 502); }

  const urls = new Set();
  const results = (Array.isArray(parsed?.results) ? parsed.results : [])
    .filter((r) => typeof r?.url === 'string' && /^https?:\/\//.test(r.url) && seen.has(hostOf(r.url)))
    .filter((r) => !urls.has(r.url) && urls.add(r.url))
    .slice(0, 8)
    .map((r) => ({
      title: String(r.title || hostOf(r.url)).slice(0, 200),
      url: r.url,
      host: hostOf(r.url),
      snippet: String(r.snippet ?? '').slice(0, 500),
      publishedDate: null,
      source: 'external',
      needsConfirmation: true,
    }));

  await supabase.from('ai_requests').insert({ user_id: user.id, kind: 'discover', input: { query }, output: { count: results.length } });
  return NextResponse.json({ results, retrievedAt: new Date().toISOString() });
}
