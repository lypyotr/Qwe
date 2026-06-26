# tg-notify — Telegram proxy (Supabase Edge Function)

Sends a shift summary to Telegram so the bot token never ships in the public web
client. The web app calls it via `supabase.functions.invoke('tg-notify', { body: { text } })`
with the signed-in user's session.

## One-time setup

1. **Rotate the bot token.** The old token was committed to a public repo and
   sent through a public client — consider it compromised. In @BotFather:
   `/revoke` → get a fresh token.

2. **Set the secrets** (replace with your fresh values):

   ```bash
   supabase secrets set \
     TG_BOT_TOKEN=123456:NEW_TOKEN_FROM_BOTFATHER \
     TG_CHAT_ID=288165396 \
     TG_ALLOWED_EMAIL=lypyotr@yandex.ru
   # alternatively lock by user id instead of email:
   # supabase secrets set TG_ALLOWED_UID=<your-supabase-user-uuid>
   ```

   With `TG_ALLOWED_EMAIL` (or `TG_ALLOWED_UID`) set, only that account can send;
   every other authenticated user gets `403 forbidden`.

   `SUPABASE_URL` and `SUPABASE_ANON_KEY` are injected automatically — do not set them.

3. **Deploy:**

   ```bash
   supabase functions deploy tg-notify
   ```

   JWT verification is on by default, and the function additionally checks that the
   caller is an authenticated user (`auth.getUser()`), so the public anon key alone
   cannot trigger a send.

## Test

```bash
curl -i -X POST "https://<project-ref>.supabase.co/functions/v1/tg-notify" \
  -H "Authorization: Bearer <a-logged-in-user-access-token>" \
  -H "Content-Type: application/json" \
  -d '{"text":"тест из tg-notify"}'
```

Expected: `{"ok":true}` and a Telegram message in the configured chat.

## Responses

| status | meaning                                  |
|--------|------------------------------------------|
| 200    | `{"ok":true}` — delivered                |
| 400    | empty text                               |
| 401    | not authenticated                        |
| 403    | authenticated but not the allowed user   |
| 500    | secrets not configured                   |
| 502    | Telegram API rejected the request        |
