export async function onRequestPost(context) {
  const { env, request } = context;
  const TOKENS = env.TOKENS;

  let body = {};
  try { body = await request.json(); } catch {}

  const username = (body.username || "").trim() || "user" + Math.floor(10000 + Math.random() * 90000);
  const token = crypto.randomUUID();

  await TOKENS.put(token, username);

  return new Response(JSON.stringify({ username, token }), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}
