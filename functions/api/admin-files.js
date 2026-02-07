export async function onRequestGet({ request, env }) {
  try{
    if (!env.TOKENS) return jerr("KV binding TOKENS missing.", 500);
    const owner = request.headers.get("x-owner-token")?.trim();
    if (!env.OWNER_TOKEN) return jerr("Server missing OWNER_TOKEN env var.", 500);
    if (!owner || owner !== env.OWNER_TOKEN) return jerr("Unauthorized", 401);

    const url = new URL(request.url);
    const username = (url.searchParams.get("username") || "").trim();
    if (!username) return jerr("username required", 400);

    const token = await env.TOKENS.get(`user/${username}`);
    if (!token) return jerr("User not found", 404);

    const projRaw = await env.TOKENS.get(`${token}/project`);
    if (!projRaw) return j({ files: [] });

    const prefix = `${token}/p/meta/`;
    const files = [];

    let cursor = undefined;
    do{
      const listed = await env.TOKENS.list({ prefix, cursor });
      cursor = listed.cursor;
      for(const k of listed.keys){
        const filename = k.name.slice(prefix.length);
        const metaRaw = await env.TOKENS.get(k.name);
        let meta = null;
        try{ meta = metaRaw ? JSON.parse(metaRaw) : null; }catch{}
        files.push({ filename, meta });
      }
      if (listed.list_complete) break;
    }while(cursor);

    files.sort((a,b)=>a.filename.localeCompare(b.filename));
    return j({ files });
  }catch(e){
    return jerr(e?.message || "Admin files failed.", 500);
  }
}

const j = (d, s=200) => new Response(JSON.stringify(d), { status:s, headers:{ "content-type":"application/json" }});
const jerr = (m, s=400) => j({ error:m }, s);
