// Poora backend ek hi file mein. Vercel par /api se seedha chalta hai (koi rewrite nahi).
// Har kaam query se hota hai: /api?a=list , /api?a=add ...

// ===== Yahan apni videos seedha likh sakte hain (Upstash ke baghair bhi chalegi) =====
const SEED = [
  {
    id: '1-A14_Lo1kzZ1A7tDjsiH12nhaqd4z5IT',
    title: 'Meri Pehli Video',
    description: 'Google Drive se online chalne wali video.',
  },
  // { id: 'DRIVE_FILE_ID', title: 'Doosri video', description: '' },
];
// =====================================================================================

const SITE_TITLE = process.env.SITE_TITLE || 'Meri Video Library';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
const REDIS_KEY = 'drive-videos';
const hasStorage = !!(REDIS_URL && REDIS_TOKEN);

async function redis(cmd) {
  const r = await fetch(REDIS_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  const j = await r.json();
  if (j.error) throw new Error('Upstash: ' + j.error);
  return j.result;
}

async function loadVideos() {
  if (hasStorage) {
    const raw = await redis(['GET', REDIS_KEY]);
    if (raw) return JSON.parse(raw);
  }
  return SEED.map((v) => ({ ...v, addedAt: v.addedAt || '2026-01-01T00:00:00.000Z' }));
}

async function saveVideos(videos) {
  if (!hasStorage) {
    const e = new Error(
      'Save nahi ho sakta: Upstash Redis connect nahi hai. ' +
        'Ya to Vercel Storage se Upstash Redis jodein, ya api/index.js ke SEED list mein video khud likh dein.'
    );
    e.status = 501;
    throw e;
  }
  await redis(['SET', REDIS_KEY, JSON.stringify(videos)]);
}

function extractDriveId(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  const pats = [/\/file\/d\/([\w-]{10,})/, /\/d\/([\w-]{10,})/, /[?&]id=([\w-]{10,})/];
  for (const p of pats) {
    const m = s.match(p);
    if (m) return m[1];
  }
  return /^[\w-]{10,}$/.test(s) ? s : null;
}

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try { return JSON.parse(req.body || '{}'); } catch { return {}; }
    }
    if (Buffer.isBuffer(req.body)) {
      try { return JSON.parse(req.body.toString() || '{}'); } catch { return {}; }
    }
    return req.body;
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch { return {}; }
}

function authError(req) {
  if (!ADMIN_PASSWORD) return 'Vercel mein ADMIN_PASSWORD environment variable set nahi hai.';
  const pw = String(req.headers['x-admin-password'] || '');
  if (pw.length !== ADMIN_PASSWORD.length || pw !== ADMIN_PASSWORD) return 'Password galat hai';
  return null;
}

module.exports = async function handler(req, res) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const a = url.searchParams.get('a') || 'list';

    if (a === 'config') {
      return json(res, 200, { title: SITE_TITLE, storage: hasStorage, adminConfigured: !!ADMIN_PASSWORD });
    }

    if (a === 'list') {
      return json(res, 200, await loadVideos());
    }

    // ---- yahan se neeche sirf admin ----
    const err = authError(req);
    if (err) return json(res, 401, { error: err });

    if (a === 'login') return json(res, 200, { ok: true, storage: hasStorage });

    const body = req.method === 'POST' ? await readBody(req) : {};
    const videos = await loadVideos();

    if (a === 'add') {
      const entries = Array.isArray(body.items) ? body.items : [body];
      const added = [];
      const skipped = [];
      for (const e of entries) {
        const raw = e.link || e.id || e.url || '';
        const id = extractDriveId(raw);
        if (!id) { skipped.push({ input: raw, reason: 'Valid Drive link ya ID nahi mila' }); continue; }
        if (videos.some((v) => v.id === id)) { skipped.push({ input: id, reason: 'Pehle se maujood hai' }); continue; }
        const v = {
          id,
          title: String(e.title || '').trim().slice(0, 150) || 'Video ' + (videos.length + 1),
          description: String(e.description || '').trim().slice(0, 500),
          addedAt: new Date().toISOString(),
        };
        videos.push(v);
        added.push(v);
      }
      if (added.length) await saveVideos(videos);
      return json(res, added.length ? 200 : 400, { added, skipped });
    }

    if (a === 'rename') {
      const v = videos.find((x) => x.id === body.id);
      if (!v) return json(res, 404, { error: 'Video nahi mili' });
      const t = String(body.title || '').trim().slice(0, 150);
      if (t) v.title = t;
      await saveVideos(videos);
      return json(res, 200, v);
    }

    if (a === 'delete') {
      const i = videos.findIndex((x) => x.id === body.id);
      if (i === -1) return json(res, 404, { error: 'Video nahi mili' });
      const [removed] = videos.splice(i, 1);
      await saveVideos(videos);
      return json(res, 200, { removed });
    }

    return json(res, 404, { error: 'Unknown action: ' + a });
  } catch (e) {
    return json(res, e.status || 500, { error: e.message || 'Server error' });
  }
};
