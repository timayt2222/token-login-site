export const onRequestDelete = async ({ request, env }) => {
  const { token } = await request.json();
  if (!token) {
    return new Response(JSON.stringify({ error: "Token required" }), { status: 400 });
  }

  const username = await env.TOKENS.get(token);
  if (!username) {
    return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
  }

  // remove token
  await env.TOKENS.delete(token);

  // remove all files+meta under token
  let cursor;
  do {
    const result = await env.TOKENS.list({ prefix: `${token}/`, cursor });
    for (const key of result.keys) {
      await env.TOKENS.delete(key.name);
    }
    cursor = result.truncated ? result.cursor : null;
  } while (cursor);

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" }
  });
};
