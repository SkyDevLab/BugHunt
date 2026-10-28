/**
 * BugHunt AI Demo Application Server
 * Lightweight standalone HTTP server with deliberate defects and fixed mode.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const INITIAL_PROFILE = {
  fullName: 'Alex Morgan',
  email: 'alex.morgan@example.com',
  updatedAt: new Date('2026-01-01T00:00:00Z').toISOString()
};

function createDemoServer(options = {}) {
  const defaultFixed = options.fixed !== undefined ? options.fixed : (process.argv.includes('--fixed') || process.env.BUGGY_MODE === 'false');
  let fixedProfileState = { ...INITIAL_PROFILE };

  const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const isFixed = parsedUrl.query.mode === 'fixed' || (parsedUrl.query.mode !== 'defects' && defaultFixed);

    // CORS headers for safety
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Static asset serving
    if (req.method === 'GET') {
      if (pathname === '/' || pathname === '/index.html') {
        const filePath = path.join(__dirname, 'index.html');
        let html = fs.readFileSync(filePath, 'utf-8');
        html = html.replace('</head>', `<script>window.SERVER_DEFAULT_FIXED = ${Boolean(defaultFixed)};</script></head>`);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
        return;
      }

      if (pathname === '/styles.css') {
        const filePath = path.join(__dirname, 'styles.css');
        res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      if (pathname === '/app.js') {
        const filePath = path.join(__dirname, 'app.js');
        res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
        fs.createReadStream(filePath).pipe(res);
        return;
      }

      // API: GET /api/profile
      if (pathname === '/api/profile') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (isFixed) {
          res.end(JSON.stringify(fixedProfileState));
        } else {
          // Defect: changes do NOT persist across refresh! Reverts to INITIAL_PROFILE
          res.end(JSON.stringify(INITIAL_PROFILE));
        }
        return;
      }
    }

    // API: POST /api/profile
    if (req.method === 'POST' && pathname === '/api/profile') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        let payload = {};
        try {
          payload = JSON.parse(body || '{}');
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          return;
        }

        // Check if API failure simulated
        if (parsedUrl.query.fail === 'true' || payload.triggerFail) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 500,
            error: 'Internal Server Error',
            message: 'Database connection failed unexpectedly while updating profile record.'
          }));
          return;
        }

        if (isFixed) {
          // Fixed mode validation
          if (!payload.fullName || !payload.fullName.trim()) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Full Name is required' }));
            return;
          }

          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!payload.email || !emailRegex.test(payload.email.trim())) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Please enter a valid email address' }));
            return;
          }

          fixedProfileState = {
            fullName: payload.fullName.trim(),
            email: payload.email.trim(),
            updatedAt: new Date().toISOString()
          };

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(fixedProfileState));
        } else {
          // Defect mode:
          // 1. Accepts invalid email
          // 2. Accepts empty name
          // 3. Does not persist to server state
          const simulatedResponse = {
            fullName: payload.fullName || '',
            email: payload.email || '',
            updatedAt: new Date().toISOString()
          };
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(simulatedResponse));
        }
      });
      return;
    }

    // 404 for unknown routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  return server;
}

if (require.main === module) {
  const portArgIndex = process.argv.indexOf('--port');
  const port = portArgIndex !== -1 ? parseInt(process.argv[portArgIndex + 1], 10) : (process.env.PORT || 3000);
  const server = createDemoServer();
  server.listen(port, () => {
    console.log(`Demo app running at http://localhost:${port}`);
    console.log(`Mode: ${process.argv.includes('--fixed') ? 'FIXED' : 'DEFECTS ACTIVE'}`);
  });
}

module.exports = { createDemoServer, INITIAL_PROFILE };
