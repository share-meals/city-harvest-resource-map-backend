import http from 'http';
import {logFeatureClick} from './log-feature-click';
import {logGeocode} from './log-geocode';

const PORT = 8080;

const routes: Record<string, Function> = {
  '/log-feature-click': logFeatureClick,
  '/log-geocode': logGeocode,
};

const server = http.createServer((req, res) => {
  const url = req.url || '';

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const handler = routes[url];
  if (!handler) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  // Parse JSON body
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    const mockReq = {
      method: req.method,
      headers: req.headers,
      body: body ? JSON.parse(body) : {},
      connection: req.connection,
    };
    const mockRes = {
      set: (key: string, value: string) => res.setHeader(key, value),
      status: (code: number) => ({
        send: (msg: string) => {
          res.writeHead(code);
          res.end(msg);
        },
      }),
    };
    handler(mockReq, mockRes);
  });
});

server.listen(PORT, () => {
  console.log(`Dev server running at http://localhost:${PORT}`);
  console.log('Routes: /log-feature-click, /log-geocode');
  console.log('BigQuery calls are stubbed (LOCAL=true)');
});
