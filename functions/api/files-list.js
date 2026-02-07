export async function onRequestGet({ request, env }) {
  try {
    if (!env.TOKENS) return jerr("KV binding TOKENS missing.", 500);

    const token = request.headers.get("x-auth-token")?.trim();
    if (!token) return jerr("Missing x-auth-token", 401);

    const username = await env.TOKENS.get(token);
    if (!username) return jerr("Invalid token.", 401);

    const project = await env.TOKENS.get(`${token}/project`);
    if (!project) return jerr("No project.", 403);

    // Support both meta prefixes
    const listA = await listMeta(env.TOKENS, `${token}/meta/`);
    const listB = await listMeta(env.TOKENS, `${token}/p/meta/`);

    // Merge unique by filename (prefer A)
    const map = new Map();
    for (const x of listB) map.set(x.filename, x);
    for (const x of listA) map.set(x.filename, x);

    const files = Array.from(map.values()).sort((a,b)=>a.filename.localeCompare(b.filename));
    return j({ files });
  } catch (e) {
    return jerr(e?.message || "List failed.", 500);
  }
}

async function listMeta(kv, prefix){
  const out = [];
  let cursor;
  do{
    const listed = await kv.list({ prefix, cursor });
    cursor = listed.cursor;

    for (const k of listed.keys) {
      const filename = k.name.slice(prefix.length);
      const metaRaw = await kv.get(k.name);
      let meta = null;
      try { meta = metaRaw ? JSON.parse(metaRaw) : null; } catch {}
      out.push({ filename, meta });
    }
    if (listed.list_complete) break;
  }while(cursor);
  return out;
}

const j = (d, s=200) => new Response(JSON.stringify(d), { status:s, headers:{ "content-type":"application/json" }});
const jerr = (m, s=400) => j({ error:m }, s);
