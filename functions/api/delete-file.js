export const onRequestDelete = async ({ request, env }) => {
  const token = request.headers.get("x-auth-token");
  if (!token) return new Response(JSON.stringify({ error: "Missing token" }), { status: 401 });

  const body = await request.json();
  const { filename } = body;
  if (!filename) {
    return new Response(JSON.stringify({ error: "Filename required" }), { status: 400 });
  }

  const username = await env.TOKENS.get(token);
  if (!username) return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });

  await env.TOKENS.delete(`${token}/files/${filename}`);
  await env.TOKENS.delete(`${token}/meta/${filename}`);

  return new Response(JSON.stringify({ success: true, deleted: filename }), {
    headers: { "Content-Type": "application/json" }
  });
};
