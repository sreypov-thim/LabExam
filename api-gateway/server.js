require("dotenv").config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

const PORT = process.env.PORT || 3000;
// Pod 1: registration runs in the same pod, so it is reached via localhost.
const REGISTRATION_URL = process.env.REGISTRATION_URL || 'http://localhost:3001';
// Pod 2: update service is reached through its Kubernetes Service name.
const UPDATE_URL = process.env.UPDATE_URL || 'http://localhost:3002';

const onError = (err, req, res) => {
  console.error('Proxy error:', err.message);
  if (res && typeof res.writeHead === 'function' && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Bad gateway: downstream service unavailable' }));
  }
};

const stripApi = { '^/api': '' };

// Registration service: POST /api/register, GET /api/students, GET /api/students/:id
const toRegistration = createProxyMiddleware({
  target: REGISTRATION_URL,
  changeOrigin: true,
  pathRewrite: stripApi,
  pathFilter: (path, req) =>
    path === '/api/register' ||
    (req.method === 'GET' && (path === '/api/students' || /^\/api\/students\/[^/]+$/.test(path))),
  on: { error: onError }
});

// Update service: PUT /api/students/:id/mobile, PUT /api/students/:id/password, PATCH /api/students/:id
const toUpdate = createProxyMiddleware({
  target: UPDATE_URL,
  changeOrigin: true,
  pathRewrite: stripApi,
  pathFilter: (path, req) =>
    (req.method === 'PUT' || req.method === 'PATCH') && /^\/api\/students\/[^/]+/.test(path),
  on: { error: onError }
});

app.get('/health', (req, res) => {
  res.json({ service: 'api-gateway', status: 'UP' });
});

app.use(toRegistration);
app.use(toUpdate);

app.use((req, res) => {
  res.status(404).json({ message: `No route for ${req.method} ${req.originalUrl}` });
});

app.listen(PORT, () => {
  console.log(`API Gateway listening on port ${PORT}`);
  console.log(`  -> registration: ${REGISTRATION_URL}`);
  console.log(`  -> update:       ${UPDATE_URL}`);
});
