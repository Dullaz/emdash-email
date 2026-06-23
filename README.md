# @dullaz/email

A dedicated **email transport** plugin for EmDash with a pluggable provider
abstraction. Ships a **Cloudflare Email Sending** provider; more (Resend, SMTP,
SES…) can be added by implementing one interface.

## How it fits EmDash's email model

EmDash has a built-in email pipeline:

- Any plugin (or EmDash core) sends mail via `ctx.email.send()` (capability
  `email:send`).
- Exactly **one** plugin delivers it — the exclusive `email:deliver` transport
  (capability `hooks.email-transport:register`). Multiple transports can be
  installed; the admin picks the active one in **Settings → Email**.
- `email:beforeSend` / `email:afterSend` are non-exclusive middleware.

This plugin **is the transport**. It does not send its own mail — it delivers
whatever the rest of the site sends (order confirmations, magic links, admin
invites, …).

## Install

```js
// astro.config.mjs
import { emailPlugin } from "@dullaz/email";

emdash({ plugins: [emailPlugin(), commercePlugin()] });
```

## Configure

Open the plugin's **Email** admin page
(`/_emdash/admin/plugins/dullaz-email/settings`):

1. Pick a **provider** (Cloudflare).
2. Fill its fields. For Cloudflare: **Account ID**, **API token** (Email Sending
   permission), **From email** (on a domain onboarded via
   `wrangler email sending enable <domain>`), **From name**. Secrets are write-only
   in the form (shown as "saved", blank to keep).
3. **Save**, and use **Send test email** to verify.

Then **activate** the transport:

- **Production**: this is the only `email:deliver` provider, so EmDash
  **auto-selects it** on boot — nothing else to do.
- **Development**: EmDash also registers a console provider, so two exist and
  neither auto-selects. Choose one in **Settings → Email** (console captures mail
  to the dev log — `📧 [dev-email]` — for testing without real sends).

## Architecture

| File | Role |
| ---- | ---- |
| `src/providers/provider.ts` | `EmailProvider` interface (`fields`/`validate`/`send`) |
| `src/providers/cloudflare.ts` | Cloudflare Email Sending via REST (`ctx.http`) |
| `src/providers/index.ts` | Provider registry |
| `src/config.ts` | Active provider + per-provider config in plugin KV |
| `src/email.ts` | The `email:deliver` dispatch to the active provider |
| `src/routes.ts` | Admin config read/save (secrets masked) + test send |
| `src/admin/EmailSettingsPage.tsx` | Settings UI |

### Adding a provider

Implement `EmailProvider` and register it in `src/providers/index.ts`. Its
`fields` drive the admin form automatically; `validate()` gates sending;
`send()` does the work (use `ctx.http.fetch` for HTTP providers and declare the
host in the plugin's `allowedHosts`).

## Notes

- Provider secrets are stored in the plugin's KV. This EmDash version does not
  yet encrypt plugin secrets at rest, so scope API tokens narrowly (Email
  Sending only) and rotate if exposed.
- Tests: `bun test`.
