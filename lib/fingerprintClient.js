const DEFAULT_URL = 'http://127.0.0.1:8765';

function baseUrl() {
  return process.env.FINGERPRINT_SERVICE_URL || DEFAULT_URL;
}

async function enrollFingerprint(label) {
  const payload = {};
  if (typeof label === 'string' && label.trim() !== '') {
    payload.label = label.trim();
  }
  const res = await fetch(`${baseUrl()}/v1/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Fingerprint enroll failed: ${res.status} ${t}`);
  }
  return res.json();
}

async function verifyFingerprint() {
  const res = await fetch(`${baseUrl()}/v1/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Fingerprint verify failed: ${res.status} ${t}`);
  }
  return res.json();
}

async function listFingerprints() {
  const res = await fetch(`${baseUrl()}/v1/list`, {
    method: 'GET',
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Fingerprint list failed: ${res.status} ${t}`);
  }
  return res.json();
}

async function deleteFingerprint(templateId) {
  const res = await fetch(`${baseUrl()}/v1/delete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ template_id: Number(templateId) }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Fingerprint delete failed: ${res.status} ${t}`);
  }
  return res.json();
}

module.exports = {
  enrollFingerprint,
  verifyFingerprint,
  listFingerprints,
  deleteFingerprint,
  baseUrl,
};
