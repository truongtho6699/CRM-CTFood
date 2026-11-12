// Public infrastructure check only. Never disclose customer rows or secrets.
export async function onRequestGet({env}) {
  if (!env.DB) return Response.json({ok:false,service:'ctfood-crm',database:'unbound'},{status:503,headers:{'Cache-Control':'no-store'}});
  try {
    await env.DB.prepare('SELECT 1 AS ready').first();
    return Response.json({ok:true,service:'ctfood-crm',database:'connected',access:'not-enabled',writeAccess:'locked'},{headers:{'Cache-Control':'no-store'}});
  } catch {
    return Response.json({ok:false,service:'ctfood-crm',database:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
