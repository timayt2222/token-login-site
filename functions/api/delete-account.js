export async function onRequestDelete({ request, env }) {
  try {
    if (!env.TOKENS) return jerr("KV binding TOKENS missing.", 500);

    const body = await request.json().catch(() => null);
    const token = (body?.token || "").trim();
    if (!token) return jerr("token required", 400);

    const username = await env.TOKENS.get(token);
    if (!username) return jerr("Invalid token", 401);

    // delete all under token/
    await deletePrefix(env.TOKENS, `${token}/`);

    // delete main token and username map
    await env.TOKENS.delete(token);
    await env.TOKENS.delete(`user/${username}`);

    return j({ ok:true });
  } catch (e) {
    return jerr(e?.message || "Delete account failed.", 500);
  }
}

async function deletePrefix(kv, prefix){
  let cursor = undefined;
  do{
    const listed = await kv.list({ prefix, cursor });
    cursor = listed.cursor;
    for(const k of listed.keys){
      await kv.delete(k.name);
    }
    if (listed.list_complete) break;
  }while(cursor);
}

const j = (d, s=200) => new Response(JSON.stringify(d), { status:s, headers:{ "content-type":"application/json" }});
const jerr = (m, s=400) => j({ error:m }, s);
