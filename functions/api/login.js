export async function onRequestPost({ request, env }) {
  try {
    if (!env.TOKENS) return jerr("KV binding TOKENS missing.", 500);

    const body = await request.json().catch(() => null);
    const token = (body?.token || "").trim();
    if (!token) return jerr("token required", 400);

    const username = await env.TOKENS.get(token);
    if (!username) return jerr("Invalid token.", 401);

    return j({ username });
  } catch (e) {
    return jerr(e?.message || "Login failed.", 500);
  }
}

const j = (d, s=200) => new Response(JSON.stringify(d), { status:s, headers:{ "content-type":"application/json" }});
const jerr = (m, s=400) => j({ error:m }, s);
