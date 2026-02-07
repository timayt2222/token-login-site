export async function onRequestDelete({ request, env }) {
  try {
    if (!env.TOKENS) return jerr("KV binding TOKENS missing.", 500);

    const token = request.headers.get("x-auth-token")?.trim();
    if (!token) return jerr("Missing x-auth-token", 401);

    const username = await env.TOKENS.get(token);
    if (!username) return jerr("Invalid token.", 401);

    const projRaw = await env.TOKENS.get(`${token}/project`);
    if (!projRaw) return jerr("No project.", 403);

    const body = await request.json().catch(() => null);
    const filename = sanitizeFilename(body?.filename || "");
    if (!filename) return jerr("filename required", 400);

    await env.TOKENS.delete(`${token}/p/files/${filename}`);
    await env.TOKENS.delete(`${token}/p/meta/${filename}`);

    return j({ ok:true });
  } catch (e) {
    return jerr(e?.message || "Delete failed.", 500);
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

const j = (d, s=200) => new Response(JSON.stringify(d), { status:s, headers:{ "content-type":"application/json" }});
const jerr = (m, s=400) => j({ error:m }, s);
