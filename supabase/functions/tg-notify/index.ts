// Supabase Edge Function: tg-notify
// Forwards a short text message to a Telegram chat using a bot token that lives
// ONLY in this function's secrets — never in the public web client.
//
// Secrets (set via `supabase secrets set ...`):
//   TG_BOT_TOKEN     — bot token from @BotFather (rotate the old leaked one!)
//   TG_CHAT_ID       — destination chat id (e.g. 288165396)
//   TG_ALLOWED_EMAIL — (optional) restrict sending to this login email
//   TG_ALLOWED_UID   — (optional) restrict sending to this Supabase user id
//
// Auth: the function verifies the caller is a logged-in Supabase user, so the
// public anon key alone is not enough to trigger a send.
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const token = Deno.env.get("TG_BOT_TOKEN");
  const chatId = Deno.env.get("TG_CHAT_ID");
  if (!token || !chatId) return json({ error: "function not configured" }, 500);

  // Require a genuine authenticated user (not just the public anon key).
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401);

  // Restrict to a single owner. Set TG_ALLOWED_EMAIL (easiest — your login email)
  // and/or TG_ALLOWED_UID. If either is set, the caller must match it.
  const allowedUid = Deno.env.get("TG_ALLOWED_UID");
  if (allowedUid && user.id !== allowedUid) return json({ error: "forbidden" }, 403);

  const allowedEmail = Deno.env.get("TG_ALLOWED_EMAIL");
  if (
    allowedEmail &&
    (user.email ?? "").toLowerCase() !== allowedEmail.toLowerCase()
  ) {
    return json({ error: "forbidden" }, 403);
  }

  let payload: { text?: string } = {};
  try {
    payload = await req.json();
  } catch (_) {
    // ignore — handled by the empty-text check below
  }
  const text = String(payload?.text ?? "").trim().slice(0, 4000);
  if (!text) return json({ error: "empty text" }, 400);

  const tgRes = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    },
  );
  const tg = await tgRes.json().catch(() => ({}));
  if (!tgRes.ok || !tg.ok) {
    return json({ error: tg.description ?? `telegram error ${tgRes.status}` }, 502);
  }
  return json({ ok: true });
});
