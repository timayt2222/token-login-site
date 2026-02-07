function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000; // 32KB chunks to avoid stack issues
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export const onRequestPost = async ({ request, env }) => {
  const token = request.headers.get("x-auth-token");
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing x-auth-token header" }), { status: 401 });
  }

  const username = await env.TOKENS.get(token);
  if (!username) {
    return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
  }

  const form = await request.formData();
  const files = form.getAll("files");
  if (!files?.length) {
    return new Response(JSON.stringify({ error: "No files uploaded" }), { status: 400 });
  }

  const uploaded = [];

  for (const f of files) {
    if (!(f instanceof File)) continue;

    const buf = await f.arrayBuffer();
    const size = buf.byteLength;

    if (size > 2 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: `File too large (2MB max): ${f.name}` }), { status: 413 });
    }

    const b64 = arrayBufferToBase64(buf);

    await env.TOKENS.put(`${token}/files/${f.name}`, b64);
    await env.TOKENS.put(`${token}/meta/${f.name}`, JSON.stringify({ size, type: f.type || "application/octet-stream" }));

    uploaded.push({ name: f.name, size });
  }

  return new Response(JSON.stringify({ uploaded }), {
    headers: { "Content-Type": "application/json" }
  });
};
