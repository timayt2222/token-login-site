export const onRequestGet = async ({ request, env }) => {
  const token = request.headers.get("x-auth-token");
  if (!token) {
    return new Response(JSON.stringify({ error: "Missing token header" }), { status: 401 });
  }

  const username = await env.TOKENS.get(token);
  if (!username) {
    return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
  }

  const list = [];
  let cursor;

  do {
    const result = await env.TOKENS.list({ prefix: `${token}/meta/`, cursor });
    result.keys.forEach(k => {
      const fileName = k.name.split("/")[2];
      list.push(fileName);
    });
    cursor = result.truncated ? result.cursor : null;
  } while (cursor);

  return new Response(JSON.stringify({ files: list }), {
    headers: { "Content-Type": "application/json" }
  });
};
