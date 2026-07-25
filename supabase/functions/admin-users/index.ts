import { createClient } from "jsr:@supabase/supabase-js@2";

const ADMIN_EMAIL = "lypyotr@yandex.ru";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });
}

function cleanText(value: unknown, max = 200): string {
  return String(value ?? "").trim().slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return json({ error: "function not configured" }, 500);

  const callerClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !caller) return json({ error: "unauthorized" }, 401);
  if ((caller.email ?? "").toLowerCase() !== ADMIN_EMAIL) return json({ error: "forbidden" }, 403);

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  try {
    const action = cleanText(body.action, 30);

    if (action === "list") {
      const page = Math.max(1, Math.min(1000, Number(body.page) || 1));
      const perPage = Math.max(1, Math.min(100, Number(body.perPage) || 100));
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const ids = data.users.map((user) => user.id);
      const profiles = ids.length
        ? await admin.from("profiles").select("user_id,seq,name,updated_at").in("user_id", ids)
        : { data: [], error: null };
      if (profiles.error) throw profiles.error;
      const profileMap = new Map((profiles.data ?? []).map((p) => [p.user_id, p]));
      return json({
        users: data.users.map((user) => ({
          id: user.id,
          email: user.email ?? "",
          phone: user.phone ?? "",
          created_at: user.created_at,
          updated_at: user.updated_at,
          last_sign_in_at: user.last_sign_in_at,
          email_confirmed_at: user.email_confirmed_at,
          banned_until: user.banned_until,
          is_anonymous: user.is_anonymous,
          user_metadata: user.user_metadata ?? {},
          app_metadata: user.app_metadata ?? {},
          profile: profileMap.get(user.id) ?? null,
        })),
        total: data.total ?? data.users.length,
        page,
        perPage,
      });
    }

    if (action === "create") {
      const email = cleanText(body.email, 320).toLowerCase();
      const password = cleanText(body.password, 200);
      const name = cleanText(body.name, 100);
      const phone = cleanText(body.phone, 40);
      if (!email || !email.includes("@")) return json({ error: "invalid email" }, 400);
      if (password.length < 8) return json({ error: "password must be at least 8 characters" }, 400);
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        phone: phone || undefined,
        email_confirm: body.email_confirm !== false,
        user_metadata: { name },
      });
      if (error) throw error;
      if (data.user && name) {
        const profile = await admin.from("profiles").upsert({
          user_id: data.user.id,
          name,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        if (profile.error) throw profile.error;
      }
      return json({ user: data.user }, 201);
    }

    const userId = cleanText(body.user_id, 50);
    if (!userId) return json({ error: "user_id required" }, 400);
    if (userId === caller.id && action === "delete") {
      return json({ error: "you cannot delete your own administrator account" }, 400);
    }

    if (action === "update") {
      const attrs: Record<string, unknown> = {};
      if ("email" in body) attrs.email = cleanText(body.email, 320).toLowerCase();
      if ("phone" in body) attrs.phone = cleanText(body.phone, 40);
      if (cleanText(body.password, 200)) attrs.password = cleanText(body.password, 200);
      if ("email_confirm" in body) attrs.email_confirm = Boolean(body.email_confirm);
      if ("ban_duration" in body) attrs.ban_duration = cleanText(body.ban_duration, 30) || "none";
      if ("user_metadata" in body && body.user_metadata && typeof body.user_metadata === "object") {
        attrs.user_metadata = body.user_metadata;
      }
      const { data, error } = await admin.auth.admin.updateUserById(userId, attrs);
      if (error) throw error;
      if ("name" in body) {
        const name = cleanText(body.name, 100);
        const profile = await admin.from("profiles").upsert({
          user_id: userId,
          name,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        if (profile.error) throw profile.error;
      }
      return json({ user: data.user });
    }

    if (action === "delete") {
      const { error } = await admin.auth.admin.deleteUser(userId, false);
      if (error) throw error;
      return json({ ok: true });
    }

    return json({ error: "unknown action" }, 400);
  } catch (error) {
    console.error("admin-users", error);
    const message = error instanceof Error ? error.message : "operation failed";
    return json({ error: message }, 400);
  }
});
