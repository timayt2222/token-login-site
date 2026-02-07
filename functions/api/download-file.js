export async function onRequestGet({ request, env }) {
  try {
    if (!env.TOKENS) return err("KV binding TOKENS missing.", 500);

    const token = request.headers.get("x-auth-token")?.trim();
    if (!token) return err("Missing x-auth-token", 401);

    const username = await env.TOKENS.get(token);
    if (!username) return err("Invalid token.", 401);

    const projRaw = await env.TOKENS.get(`${token}/project`);
    if (!projRaw) return err("No project.", 403);

    const url = new URL(request.url);
    const filename = sanitizeFilename(url.searchParams.get("filename") || "");
    if (!filename) return err("Bad filename", 400);

    const metaRaw = await env.TOKENS.get(`${token}/p/meta/${filename}`);
    const meta = metaRaw ? JSON.parse(metaRaw) : null;

    const b64 = await env.TOKENS.get(`${token}/p/files/${filename}`);
    if (!b64) return err("File not found", 404);

    const bytes = base64ToUint8Array(b64);

    return new Response(bytes, {
      headers: {
        "content-type": meta?.type || "application/octet-stream",
        "content-disposition": `attachment; filename="${filename}"`,
      }
    });
  } catch (e) {
    return err(e?.message || "Download failed.", 500);
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

function base64ToUint8Array(b64) {
  const bin = atob(b64);
  const len = bin.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

const err = (m, s=400) => new Response(m, { status:s });
