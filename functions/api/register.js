export async function onRequestPost({ request, env }) {
  try {
    if (!env.TOKENS) {
      return jsonError("KV binding TOKENS is missing. Add it in Pages → Settings → Bindings.", 500);
    }

    const body = await request.json().catch(() => null);
    const username = (body?.username || "").trim();

    if (!username || username.length < 3 || username.length > 32) {
      return jsonError("username must be 3–32 chars.", 400);
    }

    // generate token
    const token = crypto.randomUUID().replace(/-/g, "");

    // store token -> username
    // key: <token>
    // value: <username>
    await env.TOKENS.put(token, username);

    return json({ username, token });
  } catch (err) {
    return jsonError(err?.message || "Register failed.", 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function jsonError(message, status = 400) {
  return json({ error: message }, status);
}
