import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.mjs";

const env = {
  ALLOWED_SITE_ORIGIN: "https://allenxia814.github.io", ALLOWED_USER_ID: "189645776",
  GITHUB_REPO: "Allenxia814/Allenxia814.github.io",
  GITHUB_CLIENT_ID: "test-client", GITHUB_CLIENT_SECRET: "test-secret",
  STATE_SECRET: "test-state-secret-at-least-32-characters",
};
const authOrigin = "https://auth.example.workers.dev";
async function start() {
  const response = await worker.fetch(new Request(`${authOrigin}/auth?provider=github&site_id=allenxia814.github.io`), env);
  assert.equal(response.status, 302);
  return { cookie: response.headers.get("set-cookie").split(";")[0], authorize: new URL(response.headers.get("location")) };
}
function callback(flow, state = flow.authorize.searchParams.get("state")) {
  return new Request(`${authOrigin}/callback?code=test-code&state=${state}`, { headers: { Cookie: flow.cookie } });
}
test("OAuth redirect uses PKCE and an encrypted secure session", async () => {
  const flow = await start();
  assert.equal(flow.authorize.origin, "https://github.com");
  assert.equal(flow.authorize.searchParams.get("code_challenge_method"), "S256");
  assert.equal(flow.authorize.searchParams.get("scope"), "public_repo");
  assert(!flow.cookie.includes(flow.authorize.searchParams.get("state")));
  const r = await worker.fetch(new Request(`${authOrigin}/auth?provider=github&site_id=allenxia814.github.io`), env);
  assert.match(r.headers.get("set-cookie"), /HttpOnly; Secure; SameSite=Lax/);
});
test("unconfigured services and foreign sites cannot start authentication", async () => {
  assert.equal((await worker.fetch(new Request(`${authOrigin}/auth`), {})).status, 503);
  assert.equal((await worker.fetch(new Request(`${authOrigin}/auth?provider=github&site_id=evil.example`), env)).status, 400);
});
test("missing, tampered and mismatched sessions never exchange codes", async () => {
  const flow = await start();
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error("Must not fetch"); };
  try {
    const requests = [callback(flow, "wrong-state"), new Request(`${authOrigin}/callback?code=test-code&state=x`), callback({ ...flow, cookie: flow.cookie + "tampered" })];
    for (const request of requests) {
      const r = await worker.fetch(request, env);
      assert.match(await r.text(), /authorization:github:error:/);
      assert.match(r.headers.get("set-cookie"), /Max-Age=0/);
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});
test("only the numeric owner with repository write access receives a token", async () => {
  for (const [id, push, allowed] of [[189645776, true, true], [123, true, false], [189645776, false, false]]) {
    const flow = await start();
    const original = globalThis.fetch;
    let revoked = false;
    globalThis.fetch = async (url, options) => {
      if (url.endsWith("/access_token")) {
        const body = JSON.parse(options.body);
        assert.equal(body.redirect_uri, `${authOrigin}/callback`);
        const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body.code_verifier));
        assert.equal(Buffer.from(hash).toString("base64url"), flow.authorize.searchParams.get("code_challenge"));
        return Response.json({ access_token: "test-only-token", token_type: "bearer" });
      }
      if (url.endsWith("/user")) return Response.json({ id, login: "Allenxia814" });
      if (url.includes("/repos/")) return Response.json({ permissions: { push } });
      if (options.method === "DELETE") { revoked = true; return new Response(null, { status: 204 }); }
      throw new Error("Unexpected URL");
    };
    try {
      const response = await worker.fetch(callback(flow), env);
      const html = await response.text();
      assert.equal(html.includes("authorization:github:success:"), allowed);
      assert.equal(html.includes("test-only-token"), allowed);
      assert.equal(revoked, !allowed);
      assert.match(html, /event.origin !== target/);
      assert.match(html, /event.source !== window.opener/);
      assert(!html.includes('postMessage(message, "*")'));
      assert.match(response.headers.get("content-security-policy"), /default-src 'none'/);
    } finally { globalThis.fetch = original; }
  }
});
