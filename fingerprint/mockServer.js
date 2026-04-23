#!/usr/bin/env node
/**
 * Local-only mock R307-style fingerprint service for development and Pi demos.
 * Bind to 127.0.0.1. Replace with a serial-backed service for real R307 hardware.
 *
 * Env:
 *   FP_BIND=127.0.0.1  FP_PORT=8765
 *   MOCK_FINGERPRINT_VERIFY_TEMPLATE_ID — if set, /v1/verify always returns this id
 */
const http = require('http');

const host = process.env.FP_BIND || '127.0.0.1';
const port = Number(process.env.FP_PORT) || 8765;

let nextTemplateId = 0;
let lastEnrolledTemplateId = null;
const labelsByTemplateId = new Map();

function json(res, status, body) {
  const s = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(s),
  });
  res.end(s);
}

function parseJsonBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch (_e) {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return json(res, 200, { ok: true, mode: 'mock' });
  }
  if (req.method === 'GET' && req.url === '/v1/list') {
    const templates = [...labelsByTemplateId.entries()].map(([templateId, label]) => ({
      template_id: templateId,
      label,
    }));
    return json(res, 200, {
      mode: 'mock',
      template_count: templates.length,
      templates,
    });
  }
  if (req.method === 'POST' && req.url === '/v1/enroll') {
    const body = await parseJsonBody(req);
    nextTemplateId += 1;
    lastEnrolledTemplateId = nextTemplateId;
    const label =
      typeof body.label === 'string' && body.label.trim() !== ''
        ? body.label.trim()
        : `User ${lastEnrolledTemplateId}`;
    labelsByTemplateId.set(lastEnrolledTemplateId, label);
    return json(res, 200, {
      template_id: lastEnrolledTemplateId,
      label,
      enrolled_at: new Date().toISOString(),
    });
  }
  if (req.method === 'POST' && req.url === '/v1/verify') {
    const forced = process.env.MOCK_FINGERPRINT_VERIFY_TEMPLATE_ID;
    let templateId = null;
    if (forced !== undefined && forced !== '') {
      templateId = Number(forced);
    } else if (lastEnrolledTemplateId != null) {
      templateId = lastEnrolledTemplateId;
    }
    return json(res, 200, {
      template_id: templateId,
      matched: templateId != null,
      accuracy_score: templateId != null ? 200 : 0,
      label: templateId != null ? labelsByTemplateId.get(templateId) || null : null,
    });
  }
  if (req.method === 'POST' && req.url === '/v1/delete') {
    const body = await parseJsonBody(req);
    const templateId = Number(body.template_id);
    if (!Number.isInteger(templateId) || templateId < 0) {
      return json(res, 400, { message: 'invalid_template_id' });
    }
    labelsByTemplateId.delete(templateId);
    if (lastEnrolledTemplateId === templateId) {
      lastEnrolledTemplateId = null;
    }
    return json(res, 200, { deleted: true, template_id: templateId });
  }
  json(res, 404, { error: 'not_found' });
});

server.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`Fingerprint mock listening on http://${host}:${port}`);
});
