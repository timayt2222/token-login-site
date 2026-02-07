export async function onRequestGet({ request, env }) {
  try {
    if (!env.TOKENS) return jerr("KV binding TOKENS missing.", 500);

    const token = request.headers.get("x-auth-token")?.trim();
    if (!token) return jerr("Missing x-auth-token", 401);

    const username = await env.TOKENS.get(token);
    if (!username) return jerr("Invalid token.", 401);

    const raw = await env.TOKENS.get(`${token}/project`);
    const project = raw ? JSON.parse(raw) : null;

    return j({ project });
  } catch (e) {
    return jerr(e?.message || "Project get failed.", 500);
  }
}

const j = (d, s=200) => new Response(JSON.stringify(d), { status:s, headers:{ "content-type":"application/json" }});
const jerr = (m, s=400) => j({ error:m }, s);
