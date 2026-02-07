export async function onRequestGet({ request, env }) {
  try {
    if (!env.TOKENS) return jerr("KV binding TOKENS missing.", 500);

    const token = request.headers.get("x-auth-token")?.trim();
    if (!token) return jerr("Missing x-auth-token", 401);

    const username = await env.TOKENS.get(token);
    if (!username) return jerr("Invalid token.", 401);

    const projRaw = await env.TOKENS.get(`${token}/project`);
    if (!projRaw) return jerr("No project.", 403);

    const prefix = `${token}/p/meta/`;
    const files = [];

    let cursor = undefined;
    do {
      const listed = await env.TOKENS.list({ prefix, cursor });
      cursor = listed.cursor;

      for (const k of listed.keys) {
        const filename = k.name.slice(prefix.length);
        const metaRaw = await env.TOKENS.get(k.name);
        let meta = null;
        try { meta = metaRaw ? JSON.parse(metaRaw) : null; } catch {}
        files.push({ filename, meta });
      }
      if (listed.list_complete) break;
    } while (cursor);

    files.sort((a,b)=>a.filename.localeCompare(b.filename));
    return j({ files });
  } catch (e) {
    return jerr(e?.message || "List failed.", 500);
  }
}

const j = (d, s=200) => new Response(JSON.stringify(d), { status:s, headers:{ "content-type":"application/json" }});
const jerr = (m, s=400) => j({ error:m }, s);
