export async function onRequestPost(context) {
  const { env } = context;

  // KV binding name will be TOKENS (we’ll set it in dashboard later)
  const TOKENS = env.TOKENS;

  // Random username + token
  const username = "user" + Math.floor(100000 + Math.random() * 900000);
  const token = crypto.randomUUID();

  // Store: key = token, value = username
  await TOKENS.put(token, username);

  return new Response(JSON.stringify({ username, token }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}
