export async function onRequestPost({ request, env }) {
  try {
    if (!env.TOKENS) return jerr("KV binding TOKENS missing.", 500);

    const token = request.headers.get("x-auth-token")?.trim();
    if (!token) return jerr("Missing x-auth-token", 401);

    const username = await env.TOKENS.get(token);
    if (!username) return jerr("Invalid token.", 401);

    const projRaw = await env.TOKENS.get(`${token}/project`);
    if (!projRaw) return jerr("No project.", 403);

    if (!env.DISCORD_WEBHOOK_URL) return jerr("Server missing DISCORD_WEBHOOK_URL env var.", 500);

    const payload = {
      content: `▶️ Run clicked by @${username} (${new Date().toISOString()})`
    };

    const r = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!r.ok) return jerr("Webhook failed.", 502);

    return j({ ok:true });
  } catch (e) {
    return jerr(e?.message || "Run failed.", 500);
  }
}

const j = (d, s=200) => new Response(JSON.stringify(d), { status:s, headers:{ "content-type":"application/json" }});
const jerr = (m, s=400) => j({ error:m }, s);
