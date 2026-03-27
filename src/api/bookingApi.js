// Local demo API adapter (frontend-only).
// In production replace with Axios HTTP calls.

export async function healthcheck() {
  return { ok: true, source: "local-demo-api" };
}
