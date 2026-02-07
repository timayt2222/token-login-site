export async function onRequestPost({ request, env }) {
  try {
    if (!env.TOKENS) return jerr("KV binding TOKENS missing.", 500);

    const token = request.headers.get("x-auth-token")?.trim();
    if (!token) return jerr("Missing x-auth-token", 401);

    const username = await env.TOKENS.get(token);
    if (!username) return jerr("Invalid token.", 401);

    const existing = await env.TOKENS.get(`${token}/project`);
    if (existing) return jerr("Project already exists.", 409);

    const body = await request.json().catch(() => null);
    const name = (body?.name || "My Project").trim().slice(0, 50);

    const project = { name, createdAt: Date.now() };
    await env.TOKENS.put(`${token}/project`, JSON.stringify(project));

    return j({ ok: true, project });
  } catch (e) {
    return jerr(e?.message || "Create project failed.", 500);
  }
}

const j = (d, s=200) => new Response(JSON.stringify(d), { status:s, headers:{ "content-type":"application/json" }});
const jerr = (m, s=400) => j({ error:m }, s);
