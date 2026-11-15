// Local stand-in for the OpenAI Responses API (planner and web search), used only by the end-to-end test.
// They check that the app sends the request shape each provider documents, then reply
// with a response in that provider's documented shape. They are NOT the real services.
import http from 'node:http';

const PORT = Number(process.env.MOCK_PORT || 4010);
export const calls = [];
let lastPlanInput = '';

function reply(res, status, body) { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); }

const server = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    if (req.method === 'GET' && req.url.startsWith('/api/temporal/daily/point')) {
      // NASA POWER daily point stand-in (test data, not NASA's). Checks the documented query.
      const q = new URL(req.url, 'http://x').searchParams;
      const need = ['parameters', 'community', 'longitude', 'latitude', 'start', 'end', 'format'];
      const missing = need.filter((k) => !q.get(k));
      if (missing.length || !q.get('parameters').includes('PRECTOTCORR')) return reply(res, 422, { messages: [`missing ${missing.join(',')}`] });
      calls.push({ path: '/nasa-power', query: Object.fromEntries(q) });
      const series = { PRECTOTCORR: {}, T2M_MAX: {}, T2M_MIN: {}, WS2M: {} };
      const start = Number(q.get('start').slice(0, 4)); const end = Number(q.get('end').slice(0, 4));
      for (let t = Date.UTC(start, 0, 1); t <= Date.UTC(end, 11, 31); t += 86400000) {
        const d = new Date(t); const key = d.toISOString().slice(0, 10).replace(/-/g, '');
        const n = d.getUTCDate() + d.getUTCMonth() * 31 + d.getUTCFullYear();
        series.PRECTOTCORR[key] = n % 3 === 0 ? 4.2 : n % 17 === 0 ? 14 : 0; // rain on about a third of days
        series.T2M_MAX[key] = 27; series.T2M_MIN[key] = 15; series.WS2M[key] = 3;
      }
      return reply(res, 200, { type: 'Feature', header: { title: 'Mock NASA POWER (test data)', fill_value: -999 }, properties: { parameter: series } });
    }
    if (req.method === 'GET' && req.url === '/last-plan-input') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(lastPlanInput); }
    let body; try { body = JSON.parse(raw); } catch { return reply(res, 400, { error: 'bad json' }); }
    calls.push({ path: req.url, headers: req.headers, body });

    if (req.method === 'POST' && req.url === '/v1/responses' && Array.isArray(body.tools)) {
      // Web search request
      const problems = [];
      if (!/^Bearer \S+/.test(req.headers.authorization || '')) problems.push('missing bearer auth');
      if (!body.model) problems.push('missing model');
      if (!body.tools.some((t) => t.type === 'web_search')) problems.push('no web_search tool');
      if (!body.include?.includes('web_search_call.action.sources')) problems.push('sources not requested');
      const f = body.text?.format;
      if (f?.type !== 'json_schema' || f?.strict !== true) problems.push('text.format is not strict json_schema');
      if (problems.length) return reply(res, 400, { error: { message: problems.join('; ') } });
      const results = [
        { title: 'Mock Orchard Barn (test data)', url: 'https://example.com/orchard-barn', snippet: 'String lights over the orchard. The page lists seating for 180.' },
        { title: 'Mock Lakeside Pavilion (test data)', url: 'https://example.org/lakeside', snippet: 'Covered pavilion by the lake.' },
        { title: 'Invented link the search never returned', url: 'https://not-a-source.test/fake', snippet: 'Should be filtered out.' },
      ];
      return reply(res, 200, {
        id: 'resp_mock_ws', object: 'response', status: 'completed', model: body.model,
        output: [
          { type: 'web_search_call', id: 'ws_mock', status: 'completed', action: { type: 'search', query: body.input,
            sources: [{ type: 'url', url: 'https://example.com/orchard-barn' }, { type: 'url', url: 'https://www.example.org/lakeside' }] } },
          { type: 'message', id: 'msg_mock_ws', role: 'assistant', status: 'completed',
            content: [{ type: 'output_text', text: JSON.stringify({ results }), annotations: [] }] },
        ],
      });
    }

    if (req.method === 'POST' && req.url === '/v1/responses' && body.text?.format?.name === 'day_timeline') {
      // Day-of timeline draft
      const problems = [];
      if (!/^Bearer \S+/.test(req.headers.authorization || '')) problems.push('missing bearer auth');
      if (body.text.format.strict !== true || !body.text.format.schema) problems.push('text.format is not strict json_schema');
      const ids = [...String(body.input ?? '').matchAll(/- booking ([0-9a-f-]{36}):/g)].map((m) => m[1]);
      if (!String(body.input ?? '').includes('Event details')) problems.push('input not grounded in event');
      if (problems.length) return reply(res, 400, { error: { message: problems.join('; ') } });
      const items = [
        ...(ids[0] ? [{ start: '13:00', end: '15:00', title: 'Mock: first booked vendor arrives and sets up (test data)', booking_id: ids[0], notes: 'Confirm with the vendor.' }] : []),
        { start: '16:00', end: '16:30', title: 'Mock: ceremony (test data)', booking_id: '', notes: '' },
        { start: '18:00', end: '', title: 'Mock: dinner (test data)', booking_id: '00000000-0000-4000-8000-000000000000', notes: 'Invented booking id must be dropped.' },
        { start: '25:99', end: '', title: 'Invalid time must be dropped', booking_id: '', notes: '' },
      ];
      return reply(res, 200, { id: 'resp_mock_tl', object: 'response', status: 'completed', model: body.model,
        output: [{ type: 'message', id: 'msg_mock_tl', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify({ items }), annotations: [] }] }] });
    }

    if (req.method === 'POST' && req.url === '/v1/responses' && body.text?.format?.name === 'vendor_advice') {
      // Vendor walkthrough "Help me choose" request
      const problems = [];
      if (!/^Bearer \S+/.test(req.headers.authorization || '')) problems.push('missing bearer auth');
      if (body.text.format.strict !== true || !body.text.format.schema) problems.push('text.format is not strict json_schema');
      const ids = [...String(body.input ?? '').matchAll(/- id ([0-9a-f-]{36}):/g)].map((m) => m[1]);
      if (!String(body.input ?? '').includes('Event details') || !ids.length) problems.push('input not grounded in event and vendors');
      if (problems.length) return reply(res, 400, { error: { message: problems.join('; ') } });
      const advice = {
        summary: 'Mock advice (test data). The first vendor is verified and has no calendar conflict.',
        pick: ids[0],
        vendors: [{ id: ids[0], fit: 'Verified, with a published price.' }, { id: '00000000-0000-4000-8000-000000000000', fit: 'Invented vendor that must be dropped.' }],
        questions: ['Is our date open?', 'What does the package include?', 'Are tax and gratuity included?'],
      };
      return reply(res, 200, { id: 'resp_mock_adv', object: 'response', status: 'completed', model: body.model,
        output: [{ type: 'message', id: 'msg_mock_adv', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: JSON.stringify(advice), annotations: [] }] }] });
    }

    if (req.method === 'POST' && req.url === '/v1/responses') {
      const problems = [];
      if (!/^Bearer \S+/.test(req.headers.authorization || '')) problems.push('missing bearer auth');
      if (!body.model) problems.push('missing model');
      if (typeof body.input !== 'string' || !body.input.includes('Event details')) problems.push('input not grounded in event');
      if (!/Price references:[\s\S]*\$\d/.test(body.input)) problems.push('input has no price references');
      lastPlanInput = body.input;
      const f = body.text?.format;
      if (f?.type !== 'json_schema' || f?.strict !== true || !f?.schema || !f?.name) problems.push('text.format is not strict json_schema');
      if (!body.max_output_tokens) problems.push('no max_output_tokens');
      if (problems.length) return reply(res, 400, { error: { message: problems.join('; ') } });
      const plan = {
        summary: 'Mock estimate for an outdoor wedding for 150 guests.',
        assumptions: ['June date in southeast Michigan', 'Buffet service'],
        categories: [
          { name: 'Venues', low: 5000, high: 6500, notes: '' },
          { name: 'Catering', low: 7500, high: 9000, notes: 'Buffet' },
          { name: 'Taxes and service fees', low: 1200, high: 1600, notes: '' },
          { name: 'Tips', low: 600, high: 900, notes: '' },
          { name: 'Delivery and travel', low: 300, high: 500, notes: '' },
          { name: 'Setup and cleanup', low: 400, high: 700, notes: '' },
          { name: 'Contingency', low: 1500, high: 2000, notes: '' },
        ],
        missing_items: ['Rain plan'],
        cost_saving_ideas: ['Friday date'],
        checklist: [{ task: 'Book venue', when: '10 months before' }],
      };
      return reply(res, 200, {
        id: 'resp_mock', object: 'response', status: 'completed', model: body.model,
        output: [{ type: 'message', id: 'msg_mock', role: 'assistant', status: 'completed',
          content: [{ type: 'output_text', text: JSON.stringify(plan), annotations: [] }] }],
      });
    }

    if (req.method === 'GET' && req.url === '/last-plan-input') { res.writeHead(200, { 'Content-Type': 'text/plain' }); return res.end(lastPlanInput); }
    reply(res, 404, { error: 'not mocked' });
  });
});

server.listen(PORT, () => console.log(`mock providers on http://127.0.0.1:${PORT}`));
