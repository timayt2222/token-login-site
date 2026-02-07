export async function onRequestGet({ request, env }) {
  try{
    if (!env.TOKENS) return jerr("KV binding TOKENS missing.", 500);
    const owner = request.headers.get("x-owner-token")?.trim();
    if (!env.OWNER_TOKEN) return jerr("Server missing OWNER_TOKEN env var.", 500);
    if (!owner || owner !== env.OWNER_TOKEN) return jerr("Unauthorized", 401);

    const prefix = "user/";
    const users = [];

    let cursor = undefined;
    do{
      const listed = await env.TOKENS.list({ prefix, cursor });
      cursor = listed.cursor;
      for(const k of listed.keys){
        users.push(k.name.slice(prefix.length));
      }
      if (listed.list_complete) break;
    }while(cursor);

    users.sort((a,b)=>a.localeCompare(b));
    return j({ users });
  }catch(e){
    return jerr(e?.message || "Admin users failed.", 500);
  }
}

const j = (d, s=200) => new Response(JSON.stringify(d), { status:s, headers:{ "content-type":"application/json" }});
const jerr = (m, s=400) => j({ error:m }, s);
