const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 10;

export async function onRequestPost({ request, env }) {
  try {
    if (!env.TOKENS) return jerr("KV binding TOKENS missing.", 500);

    const token = request.headers.get("x-auth-token")?.trim();
    if (!token) return jerr("Missing x-auth-token", 401);

    const username = await env.TOKENS.get(token);
    if (!username) return jerr("Invalid token.", 401);

    // Must have a project
    const project = await env.TOKENS.get(`${token}/project`);
    if (!project) return jerr("No project. Create a project first.", 403);

    // Count existing files (support both layouts)
    const countA = await countKeys(env.TOKENS, `${token}/meta/`);
    const countB = await countKeys(env.TOKENS, `${token}/p/meta/`);
    const existing = Math.max(countA, countB);

    const form = await request.formData();
    const files = form.getAll("files");
    if (!files || files.length === 0) return jerr("No files received (field must be 'files').", 400);

    const allowedSlots = Math.max(0, MAX_FILES - existing);
    if (allowedSlots <= 0) {
      return j({ saved: [], rejected: files.map(f => ({ name: f?.name || "file", reason: "Max 10 files reached." })) });
    }

    const saved = [];
    const rejected = [];
    let savedNow = 0;

    for (const f of files) {
      const filename = sanitizeFilename(f?.name || "");
      const size = f?.size ?? 0;
      const type = f?.type || "application/octet-stream";

      if (!filename) { rejected.push({ name: f?.name || "(missing)", reason: "Bad filename" }); continue; }
      if (size > MAX_FILE_BYTES) { rejected.push({ name: filename, reason: "Over 2MB" }); continue; }
      if (savedNow >= allowedSlots) { rejected.push({ name: filename, reason: "Max 10 files reached" }); continue; }

      const ab = await f.arrayBuffer();
      const b64 = arrayBufferToBase64(ab);

      // ✅ Save to ORIGINAL layout (matches your “spec”)
      await env.TOKENS.put(`${token}/files/${filename}`, b64);
      await env.TOKENS.put(`${token}/meta/${filename}`, JSON.stringify({ size, type, uploadedAt: Date.now() }));

      // ✅ ALSO save to /p/ layout for compatibility (optional but helpful)
      await env.TOKENS.put(`${token}/p/files/${filename}`, b64);
      await env.TOKENS.put(`${token}/p/meta/${filename}`, JSON.stringify({ size, type, uploadedAt: Date.now() }));

      saved.push({ filename, size, type });
      savedNow++;
    }

    return j({ saved, rejected });
  } catch (e) {
    return jerr(e?.message || "Upload failed.", 500);
  }
}

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

async function countKeys(kv, prefix){
  let cursor;
  let count = 0;
  do{
    const listed = await kv.list({ prefix, cursor });
    cursor = listed.cursor;
    count += listed.keys.length;
    if (listed.list_complete) break;
  }while(cursor);
  return count;
}

const j = (d, s=200) => new Response(JSON.stringify(d), { status:s, headers:{ "content-type":"application/json" }});
const jerr = (m, s=400) => j({ error:m }, s);
