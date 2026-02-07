export async function onRequestPost(context) {
  const { env, request } = context;
  const TOKENS = env.TOKENS;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const token = (body?.token || "").trim();

  if (!token) {
    return new Response(
      JSON.stringify({ error: "Token is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // Check KV for token
  const username = await TOKENS.get(token);

  if (!username) {
    return new Response(
      JSON.stringify({ error: "Invalid token" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Success
  return new Response(
    JSON.stringify({ success: true, username }),
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store"
      }
    }
  );
}
