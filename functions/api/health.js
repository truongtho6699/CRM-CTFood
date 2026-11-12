// Public health check. Never disclose table contents, user identities, credentials or D1 IDs.
export async function onRequestGet({env}) {
  if (!env.DB) return Response.json({ok:false,service:'ctfood-crm',database:'unbound'},{status:503,headers:{'Cache-Control':'no-store'}});
  try {
    await env.DB.prepare('SELECT 1 AS ready').first();
    return Response.json({ok:true,service:'ctfood-crm',database:'connected',api:'Access JWT required',persistence:'CRM master data only'},{headers:{'Cache-Control':'no-store'}});
  } catch {
    return Response.json({ok:false,service:'ctfood-crm',database:'unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
  }
}
