// Real server-side gate for sairro.com's temporary private-beta window
// (see DEPLOYMENT.md / LAUNCH_CHECKLIST.md - remove this whole file, plus
// the BETA_GATE_PASSCODE env var, once the beta window ends).
//
// Replaces the old client-side-only check (a hardcoded passcode + a
// localStorage/sessionStorage flag inside index.html's own JS): that
// never actually blocked anything - index.html/script.js/style.css were
// always fetchable directly regardless of what the DOM overlay showed,
// and the passcode itself sat in plain text in view-source. This runs
// as Vercel Edge Middleware, in front of every request, before any file
// is served.
//
// Fails OPEN: if BETA_GATE_PASSCODE isn't set, every request passes
// through untouched - a missing/misconfigured env var should never be
// able to lock the site's own owner out, it just means the gate isn't
// active yet (identical to today's behavior before this file existed).
export const config = {
  matcher: "/:path*",
};

const COOKIE_NAME = "sairro_beta_auth";
const GATE_PATH = "/__gate";

export async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// The cookie stores a hash of the passcode, not the passcode itself, so
// it's meaningless on its own even if a request log or a browser
// extension captured it - it can only be produced by someone who already
// knew the real passcode.
export function gateHtml(errored) {
  return `<!doctype html>
<html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>sairro — private testing</title>
<style>
  :root{color-scheme:dark;}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    background:linear-gradient(160deg,#150a24,#1b0e2e);color:#f4f1fb;}
  form{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
    border-radius:16px;padding:32px;width:min(90vw,340px);box-shadow:0 20px 60px rgba(0,0,0,0.4);}
  h1{font-size:18px;margin:0 0 6px;}
  p{font-size:13px;color:#c9c2dd;margin:0 0 18px;}
  input{width:100%;box-sizing:border-box;padding:11px 12px;border-radius:10px;
    border:1px solid rgba(255,255,255,0.18);background:rgba(0,0,0,0.25);color:#fff;
    font-size:15px;margin-bottom:12px;}
  button{width:100%;padding:11px;border:none;border-radius:10px;background:#8b5cf6;
    color:#fff;font-size:15px;font-weight:600;cursor:pointer;}
  button:hover{background:#7c4dee;}
  .err{color:#ff9b9b;font-size:13px;margin:-4px 0 12px;}
</style></head>
<body>
  <form method="POST" action="${GATE_PATH}">
    <h1>sairro — private testing</h1>
    <p>Enter the access code you were given.</p>
    <input type="password" name="code" placeholder="Access code" autofocus autocomplete="off" />
    ${errored ? '<div class="err">That code isn\'t right — try again.</div>' : ""}
    <button type="submit">Enter</button>
  </form>
</body></html>`;
}

function hasValidCookie(req, validHash) {
  const cookieHeader = req.headers.get("cookie") || "";
  return cookieHeader
    .split(";")
    .map((p) => p.trim())
    .some((p) => p === `${COOKIE_NAME}=${validHash}`);
}

export default async function middleware(req) {
  const passcode = process.env.BETA_GATE_PASSCODE;
  if (!passcode) return; // gate not configured - let every request through

  const url = new URL(req.url);
  const validHash = await sha256Hex(passcode);

  if (req.method === "POST" && url.pathname === GATE_PATH) {
    const form = await req.formData();
    const submitted = String(form.get("code") || "");

    if (submitted === passcode) {
      const res = new Response(null, { status: 303, headers: { Location: "/" } });
      // No Max-Age/Expires: a browser-session cookie, closest equivalent
      // to the old sessionStorage behavior (re-ask after the browser is
      // fully closed) - cookies are shared across tabs in one browser
      // session though, unlike sessionStorage which was per-tab, so a
      // second tab opened while the first stays unlocked won't re-prompt
      // here the way it used to.
      res.headers.set(
        "Set-Cookie",
        `${COOKIE_NAME}=${validHash}; Path=/; HttpOnly; Secure; SameSite=Lax`
      );
      return res;
    }

    return new Response(gateHtml(true), {
      status: 401,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  if (hasValidCookie(req, validHash)) return; // already unlocked this session

  if (req.method === "GET") {
    return new Response(gateHtml(false), {
      status: 401,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return new Response("Unauthorized", { status: 401 });
}
