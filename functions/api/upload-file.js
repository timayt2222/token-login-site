export const onRequestPost = async ({ request, env }) => {
  const token = request.headers.get("x-auth-token");
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing token header" }), { status: 401 });
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

    const arrayBuffer = await f.arrayBuffer();
    const size = arrayBuffer.byteLength;
    if (size > 2 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: `File too large: ${f.name}` }), { status: 413 });
    }

    // encode
    const b64 = Buffer.from(arrayBuffer).toString("base64");

    // store file
    await env.TOKENS.put(`${token}/files/${f.name}`, b64);

    // store metadata
    const meta = JSON.stringify({ size, type: f.type });
    await env.TOKENS.put(`${token}/meta/${f.name}`, meta);

    uploaded.push({ name: f.name, size });
  }

  return new Response(JSON.stringify({ uploaded }), {
    headers: { "Content-Type": "application/json" }
  });
};
