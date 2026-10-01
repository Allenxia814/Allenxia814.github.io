const COOKIE = "__Host-airglow-oauth";
const MAX_AGE = 600;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
function fromBase64url(value) {
  return Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));
}
async function cookieKey(secret) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}
async function seal(session, secret) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await cookieKey(secret), encoder.encode(JSON.stringify(session)));
  return `${base64url(iv)}.${base64url(new Uint8Array(data))}`;
}
async function open(value, secret) {
  const [iv, data, extra] = value.split(".");
  if (!iv || !data || extra) throw new Error("Invalid cookie");
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64url(iv) }, await cookieKey(secret), fromBase64url(data));
  return JSON.parse(decoder.decode(plain));
}
function sessionCookie(value, maxAge) {
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
function commonHeaders() {
  return { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
}
function textResponse(text, status) {
  return new Response(text, { status, headers: { ...commonHeaders(), "Content-Type": "text/plain; charset=utf-8" } });
}
function scriptValue(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}
function popupResponse(origin, payload, success = false) {
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(16)));
  const message = `authorization:github:${success ? "success" : "error"}:${JSON.stringify(payload)}`;
  // Decap's authenticator expects this handshake from the OAuth origin.
  // The token is delivered exclusively to the configured blog origin.
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Airglow 登录</title><p>正在完成 GitHub 登录。请保持博客后台页面打开。</p><script nonce="${nonce}">
    const target = ${scriptValue(origin)};
    const message = ${scriptValue(message)};
    if (window.opener) {
      const receive = event => {
        if (event.origin !== target || event.source !== window.opener || event.data !== "authorizing:github") return;
        window.removeEventListener("message", receive);
        window.opener.postMessage(message, target);
      };
      window.addEventListener("message", receive);
      window.opener.postMessage("authorizing:github", target);
    }
  </script></html>`;
  return new Response(html, { headers: {
    ...commonHeaders(),
    "Content-Type": "text/html; charset=utf-8",
    "Set-Cookie": sessionCookie("", 0),
    "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`,
  } });
}
async function revokeToken(token, env) {
  try {
    await fetch(`https://api.github.com/applications/${encodeURIComponent(env.GITHUB_CLIENT_ID)}/token`, {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${btoa(`${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`)}`,
        Accept: "application/vnd.github+json", "Content-Type": "application/json", "User-Agent": "Airglow-OAuth",
      },
      body: JSON.stringify({ access_token: token }),
    });
  } catch { /* A denied token is never returned to the browser. */ }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET") return textResponse("Method not allowed", 405);
    if (url.pathname !== "/auth" && url.pathname !== "/callback") return textResponse("Airglow GitHub OAuth", 200);
    let site;
    try {
      site = new URL(env.ALLOWED_SITE_ORIGIN);
      if (site.protocol !== "https:" || site.origin !== env.ALLOWED_SITE_ORIGIN || !/^\d+$/.test(env.ALLOWED_USER_ID) ||
          !env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || (env.STATE_SECRET?.length || 0) < 32 ||
          !/^[\w.-]+\/[\w.-]+$/.test(env.GITHUB_REPO)) throw new Error();
    } catch {
      return textResponse("OAuth service is not configured", 503);
    }
    const callbackUrl = `${url.origin}/callback`;
    if (url.pathname === "/auth") {
      if (url.searchParams.get("provider") !== "github" || url.searchParams.get("site_id") !== site.hostname) {
        return textResponse("Invalid provider or site", 400);
      }
      const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
      const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
      const challenge = base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier))));
      const cookie = await seal({ state, verifier, callbackUrl, expires: Date.now() + MAX_AGE * 1000 }, env.STATE_SECRET);
      const authorize = new URL("https://github.com/login/oauth/authorize");
      authorize.search = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID, redirect_uri: callbackUrl,
        scope: "public_repo", state, code_challenge: challenge, code_challenge_method: "S256",
      }).toString();
      return new Response(null, { status: 302, headers: {
        ...commonHeaders(), Location: authorize.href, "Set-Cookie": sessionCookie(cookie, MAX_AGE),
      } });
    }
    let token = "";
    try {
      const cookie = (request.headers.get("Cookie") || "").split(";").map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`));
      const session = await open(cookie?.slice(COOKIE.length + 1) || "", env.STATE_SECRET);
      if (session.expires <= Date.now() || session.callbackUrl !== callbackUrl || !session.state || session.state !== url.searchParams.get("state")) {
        throw new Error("Invalid OAuth state");
      }
      const code = url.searchParams.get("code");
      if (!code || code.length > 1024 || url.searchParams.has("error")) throw new Error("Authorization cancelled");
      const response = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code,
          redirect_uri: callbackUrl, code_verifier: session.verifier }),
      });
      const result = await response.json();
      if (!response.ok || !result.access_token || result.token_type?.toLowerCase() !== "bearer") throw new Error("Token exchange failed");
      token = result.access_token;
      const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "Airglow-OAuth" };
      const userResponse = await fetch("https://api.github.com/user", { headers });
      const user = await userResponse.json();
      if (!userResponse.ok || String(user.id) !== env.ALLOWED_USER_ID) throw new Error("Not the blog owner");
      const repoResponse = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}`, { headers });
      const repo = await repoResponse.json();
      if (!repoResponse.ok || !repo.permissions?.push) throw new Error("No repository write access");
      return popupResponse(site.origin, { token, provider: "github" }, true);
    } catch {
      if (token) await revokeToken(token, env);
      return popupResponse(site.origin, { message: "登录失败：仅允许博客所有者管理文章。请使用 Allenxia814 账号重新登录。" });
    }
  },
};
