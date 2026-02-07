export async function onRequestPost({ request, env }) {
  try {
    if (!env.TOKENS) return jerr("KV binding TOKENS missing.", 500);

    const body = await request.json().catch(() => null);
    const username = (body?.username || "").trim();
    if (!username || username.length < 3 || username.length > 32) return jerr("Bad username.", 400);

    const token = crypto.randomUUID().replace(/-/g, "");

    await env.TOKENS.put(token, username);
    await env.TOKENS.put(`user/${username}`, token); // username -> token

    return j({ username, token });
  } catch (e) {
    return jerr(e?.message || "Register failed.", 500);
  }
}

const j = (d, s=200) => new Response(JSON.stringify(d), { status:s, headers:{ "content-type":"application/json" }});
const jerr = (m, s=400) => j({ error:m }, s);
