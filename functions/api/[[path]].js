// Same-origin API is reserved for authenticated access.
// Fail closed until Cloudflare Access is enabled and secrets are configured.
import worker from '../../worker/src/index.js';
export async function onRequest(context) {
  return worker.fetch(context.request,context.env,context);
}
