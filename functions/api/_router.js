const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 10;

export async function handle(route, { request, env }) {
  if (!env.TOKENS) return jerr("KV binding TOKENS missing.", 500);

  try {
    switch (route) {
      case "register": return register({ request, env });
      case "login": return login({ request, env });

      case "create-project": return createProject({ request, env });
      case "project": return getProject({ request, env });

      case "upload-file": return uploadFile({ request, env });
      case "files-list": return filesList({ request, env });
      case "download-file": return downloadFile({ request, env });

      case "delete-file": return deleteFile({ request, env });
      case "delete-account": return deleteAccount({ request, env });

      case "run": return runWebhook({ request, env });

      case "debug": return debugKeys({ request, env });

      default: return jerr("Unknown route", 404);
    }
  } catch (e) {
    return jerr(e?.message || "Server error", 500);
  }
}

// ----------------- helpers -----------------
const j = (d, s=200, extraHeaders={}) =>
  new Response(JSON.stringify(d), { status:s, headers:{ "content-type":"application/json", ...extraHeaders }});
const jerr = (m, s=400) => j({ error:m }, s);

function sanitizeFilename(name) {
  const cleaned = String(name).trim()
    .replace(/[\/\\]+/g, "_")
    .replace(/[^\w.\-() ]+/g, "_")
    .slice(0, 140);
  if (!cleaned || cleaned.replace(/\./g, "").length === 0) return "";
  return cleaned;
}

function arrayBufferToBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToUint8Array(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function requireUser(request, env) {
  const token = request.headers.get("x-auth-token")?.trim();
  if (!token) throw new Error("Missing x-auth-token");
  const username = await env.TOKENS.get(token);
  if (!username) throw new Error("Invalid token");
  return { token, username };
}

async function requireProject(token, env) {
  const project = await env.TOKENS.get(`${token}/project`);
  if (!project) throw new Error("No project. Create a project first.");
  return project;
}

async function listAllKeys(env, prefix) {
  let cursor;
  const keys = [];
  do {
    const res = await env.TOKENS.list({ prefix, cursor });
    cursor = res.cursor;
    for (const k of res.keys) keys.push(k.name);
    if (res.list_complete) break;
  } while (cursor);
  return keys;
}

async function listMeta(env, prefix) {
  let cursor;
  const out = [];
  do {
    const res = await env.TOKENS.list({ prefix, cursor });
    cursor = res.cursor;
    for (const k of res.keys) {
      const filename = k.name.slice(prefix.length);
      const metaRaw = await env.TOKENS.get(k.name);
      let meta = null;
      try { meta = metaRaw ? JSON.parse(metaRaw) : null; } catch {}
      out.push({ filename, meta });
    }
    if (res.list_complete) break;
  } while (cursor);
  return out;
}

async function countKeys(env, prefix) {
  let cursor;
  let count = 0;
  do {
    const res = await env.TOKENS.list({ prefix, cursor });
    cursor = res.cursor;
    count += res.keys.length;
    if (res.list_complete) break;
  } while (cursor);
  return count;
}

// ----------------- routes -----------------
async function register({ request, env }) {
  const body = await request.json().catch(()=>null);
  const username = (body?.username || "").trim();
  if (!username || username.length < 3 || username.length > 32) return jerr("Bad username", 400);

  const token = crypto.randomUUID().replace(/-/g, "");
  await env.TOKENS.put(token, username);
  await env.TOKENS.put(`user/${username}`, token);
  return j({ username, token });
}

async function login({ request, env }) {
  const body = await request.json().catch(()=>null);
  const token = (body?.token || "").trim();
  if (!token) return jerr("token required", 400);

  const username = await env.TOKENS.get(token);
  if (!username) return jerr("Invalid token", 401);
  return j({ username });
}

async function createProject({ request, env }) {
  const { token } = await requireUser(request, env);
  const existing = await env.TOKENS.get(`${token}/project`);
  if (existing) return jerr("Project already exists", 409);

  const body = await request.json().catch(()=>null);
  const name = (body?.name || "My Project").trim().slice(0, 50);

  const project = { name, createdAt: Date.now() };
  await env.TOKENS.put(`${token}/project`, JSON.stringify(project));
  return j({ ok:true, project });
}

async function getProject({ request, env }) {
  const { token } = await requireUser(request, env);
  const raw = await env.TOKENS.get(`${token}/project`);
  return j({ project: raw ? JSON.parse(raw) : null });
}

async function uploadFile({ request, env }) {
  const { token } = await requireUser(request, env);
  await requireProject(token, env);

  // count existing (support both layouts)
  const existingA = await countKeys(env, `${token}/meta/`);
  const existingB = await countKeys(env, `${token}/p/meta/`);
  const existing = Math.max(existingA, existingB);

  const form = await request.formData();
  const files = form.getAll("files");
  if (!files || files.length === 0) return jerr("No files received (field must be 'files')", 400);

  const allowedSlots = Math.max(0, MAX_FILES - existing);
  const saved = [];
  const rejected = [];
  let savedNow = 0;

  for (const f of files) {
    const filename = sanitizeFilename(f?.name || "");
    const size = f?.size ?? 0;
    const type = f?.type || "application/octet-stream";

    if (!filename) { rejected.push({ name: f?.name || "(missing)", reason:"Bad filename" }); continue; }
    if (size > MAX_FILE_BYTES) { rejected.push({ name: filename, reason:"Over 2MB" }); continue; }
    if (savedNow >= allowedSlots) { rejected.push({ name: filename, reason:"Max 10 files reached" }); continue; }

    const b64 = arrayBufferToBase64(await f.arrayBuffer());

    // save BOTH layouts so listing always works
    await env.TOKENS.put(`${token}/files/${filename}`, b64);
    await env.TOKENS.put(`${token}/meta/${filename}`, JSON.stringify({ size, type, uploadedAt: Date.now() }));

    await env.TOKENS.put(`${token}/p/files/${filename}`, b64);
    await env.TOKENS.put(`${token}/p/meta/${filename}`, JSON.stringify({ size, type, uploadedAt: Date.now() }));

    saved.push({ filename, size, type });
    savedNow++;
  }

  return j({ saved, rejected });
}

async function filesList({ request, env }) {
  const { token } = await requireUser(request, env);
  await requireProject(token, env);

  const listA = await listMeta(env, `${token}/meta/`);
  const listB = await listMeta(env, `${token}/p/meta/`);

  const map = new Map();
  for (const x of listB) map.set(x.filename, x);
  for (const x of listA) map.set(x.filename, x);

  const files = Array.from(map.values()).sort((a,b)=>a.filename.localeCompare(b.filename));
  return j({ files });
}

async function downloadFile({ request, env }) {
  const { token } = await requireUser(request, env);
  await requireProject(token, env);

  const url = new URL(request.url);
  const filename = sanitizeFilename(url.searchParams.get("filename") || "");
  if (!filename) return jerr("Bad filename", 400);

  // prefer A, fallback B
  const metaRaw =
    (await env.TOKENS.get(`${token}/meta/${filename}`)) ||
    (await env.TOKENS.get(`${token}/p/meta/${filename}`));
  const meta = metaRaw ? JSON.parse(metaRaw) : null;

  const b64 =
    (await env.TOKENS.get(`${token}/files/${filename}`)) ||
    (await env.TOKENS.get(`${token}/p/files/${filename}`));
  if (!b64) return jerr("File not found", 404);

  const bytes = base64ToUint8Array(b64);

  return new Response(bytes, {
    headers: {
      "content-type": meta?.type || "application/octet-stream",
      "content-disposition": `attachment; filename="${filename}"`,
    }
  });
}

async function deleteFile({ request, env }) {
  const { token } = await requireUser(request, env);
  await requireProject(token, env);

  const body = await request.json().catch(()=>null);
  const filename = sanitizeFilename(body?.filename || "");
  if (!filename) return jerr("filename required", 400);

  await env.TOKENS.delete(`${token}/files/${filename}`);
  await env.TOKENS.delete(`${token}/meta/${filename}`);

  await env.TOKENS.delete(`${token}/p/files/${filename}`);
  await env.TOKENS.delete(`${token}/p/meta/${filename}`);

  return j({ ok:true });
}

async function deleteAccount({ request, env }) {
  const body = await request.json().catch(()=>null);
  const token = (body?.token || "").trim();
  if (!token) return jerr("token required", 400);

  const username = await env.TOKENS.get(token);
  if (!username) return jerr("Invalid token", 401);

  // delete everything under token/
  const keys = await listAllKeys(env, `${token}/`);
  for (const k of keys) await env.TOKENS.delete(k);

  await env.TOKENS.delete(token);
  await env.TOKENS.delete(`user/${username}`);

  return j({ ok:true });
}

async function runWebhook({ request, env }) {
  const { username, token } = await requireUser(request, env);
  await requireProject(token, env);

  if (!env.DISCORD_WEBHOOK_URL) return jerr("Missing DISCORD_WEBHOOK_URL", 500);

  const payload = { content: `▶️ Run clicked by @${username} (${new Date().toISOString()})` };
  const r = await fetch(env.DISCORD_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type":"application/json" },
    body: JSON.stringify(payload)
  });

  if (!r.ok) return jerr("Webhook failed", 502);
  return j({ ok:true });
}

async function debugKeys({ request, env }) {
  const { token, username } = await requireUser(request, env);

  // show what exists for the token (helps instantly find mismatches)
  const prefixes = [
    `${token}/meta/`,
    `${token}/files/`,
    `${token}/p/meta/`,
    `${token}/p/files/`,
    `${token}/project`,
  ];

  const out = {};
  for (const p of prefixes) {
    if (p.endsWith("/project")) {
      out[p] = await env.TOKENS.get(p) ? "exists" : "missing";
    } else {
      out[p] = (await listAllKeys(env, p)).slice(0, 50); // limit output
    }
  }

  return j({ username, tokenPrefix: token.slice(0,8), kv: out });
}
