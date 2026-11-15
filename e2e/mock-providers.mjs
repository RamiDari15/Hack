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
