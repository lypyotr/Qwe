
# Telegram notification function

Deploy the function and configure its secrets:

```sh
supabase secrets set TG_BOT_TOKEN=... TG_CHAT_ID=... TG_ALLOWED_UID=...
supabase functions deploy tg-notify
```

`TG_ALLOWED_UID` or `TG_ALLOWED_EMAIL` is mandatory. You may set both; when
both are present the authenticated caller must match both. The function fails
closed when neither allow-list value is configured.

The function accepts authenticated `POST` requests containing:

```json
{"text":"Message up to 4000 characters"}
```

Telegram requests time out after 10 seconds and return HTTP 502 when Telegram
is unavailable.
