# Astra AI — Architecture

> Original branding. No affiliation with any existing product. Dark charcoal / gold education SaaS aesthetic.

## 1. Mission

Astra AI is a cross-platform AI tutoring platform:

| Product | Stack | Purpose |
| --- | --- | --- |
| Mobile app | React Native + Expo (TypeScript), Expo Router | Android/iOS tutoring app |
| Web app | Next.js (App Router, TypeScript), Tailwind CSS | Responsive tutor + authenticated web app |
| Landing page | Next.js public route group | Marketing + downloads |
| Backend | Next.js Route Handlers + Prisma + PostgreSQL | Auth, data, AI proxy, uploads |
| AI | Server-only provider adapter (OpenAI-compatible / Anthropic / mock) | Tutoring answers, streaming, image input |

One backend serves both clients. A user's conversations created on mobile appear on the web and vice versa.

## 2. Repository layout

```
apps/
  web/            Next.js App Router (public landing, authed app, API route handlers)
  mobile/         Expo app (Expo Router, TypeScript)
packages/
  shared/         Shared types, constants, AI prompt helpers, usage-limit logic
  validation/     Zod schemas shared between web API + mobile client
  api-client/     Typed fetch client used by web + mobile
  ui-tokens/      Design tokens (colors, spacing, radii, logo SVG)
prisma/           schema.prisma + migrations + seed.ts
docs/             architecture, setup, api, mobile-builds, deployment, security, troubleshooting
docker-compose.yml, .env.example, README.md
```

## 3. Data model (Prisma/PostgreSQL)

- **User** — id (cuid), email (unique), hashedPassword, name, role, preference columns (theme, explanation level, language).
- **Account / Session** — if an auth library needs them. Chosen approach: `next-auth` v5 (Auth.js) with Credentials provider (bcrypt hashing via library) + JWT sessions persisted server-side; scrypt/bcrypt handled by the auth library.
- **Conversation** — belongsTo User, hasMany Message. Index (userId, updatedAt). Title auto-generated from first user message.
- **Message** — belongsTo Conversation, role enum (USER/ASSISTANT/SYSTEM), content text, optional explanationLevel, hasMany Attachment. Index (conversationId, createdAt).
- **Attachment** — belongsTo Message, storage key, mime type, size bytes. BLOB-backed via storage abstraction (local FS in dev; S3-compatible interface for production).
- **Subject** — name, slug, description, color. hasMany Lesson.
- **Lesson** — belongsTo Subject, title, level enum, body.
- **SavedAnswer** — belongsTo User + Message. Unique (userId, messageId). Optional note.
- **UsageRecord** — belongsTo User, tokensIn/tokensOut, model, day. Index (userId, day) for quota checks.
- **Subscription/Entitlement** — optional; free tier default; plan column on User + entitlement row when implemented.

Cascading deletes: deleting a User deletes its sessions, conversations, messages, attachments, saved answers, usage records (referential cascade).

## 4. API surface (Next.js Route Handlers under `apps/web/src/app/api`)

All bodies validated with Zod (`@astra/validation`). Consistent error envelope: `{ error: { code, message } }`.

- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session`, `POST /api/auth/forgot-password` (token issued but no email provider → returns dev-token), `POST /api/auth/reset-password`
- `GET /api/me` — profile + usage summary
- `PATCH /api/me` — preferences
- `GET|POST /api/conversations` — list (cursor pagination) / create
- `GET /api/conversations/:id` — full thread
- `DELETE /api/conversations/:id`
- `POST /api/conversations/:id/messages` — submit user message → returns assistant reply (streaming SSE when supported)
- `POST /api/uploads` — multipart image upload → { id, url }
- `GET|POST /api/saved-answers`, `DELETE /api/saved-answers/:id`
- `GET /api/subjects`, `GET /api/subjects/:slug`
- `GET /api/usage` — counters + limits
- `GET /api/account/export` — JSON export of all owned data
- `DELETE /api/account` — deletion (re-auth via password or deleteToken)
- `GET /api/health` — liveness
- `GET /api/releases/latest` — public: latest APK metadata (version, date, size, sha256, url) from release registry; `GET /api/releases/:file` proxies/redirects to configured HTTPS release URL only if it exists (HEAD check); otherwise 404 → UI shows "Coming soon".

Authorization: every private route requires a valid session; ownership checked at query level (`where: { userId: session.user.id }`). Multi-tenancy isolation covered by integration tests.

Rate limiting: in-memory token bucket keyed by IP+route (documented; production should use Redis). Body size limits + upload mime/size validation.

## 5. AI provider abstraction

`packages/shared/src/ai/*`:

- `Provider` interface: `chat(messages, {stream, images?, signal})` → async iterable of text deltas + final usage.
- Adapters: `openai-compatible` (works for OpenAI, Groq, OpenRouter, DeepSeek, local Ollama via base URL), `anthropic`, `mock` (tests/local dev only).
- Selected by `AI_PROVIDER` env; model by `AI_MODEL`; key by `AI_API_KEY` (server-only, never sent to clients).
- Image input: openai/anthropic support vision payloads when attachment present; mock returns canned educational text.
- Missing credentials → typed `AiConfigurationError` → API returns 503 with actionable message; UI shows a configuration banner. Never fake a "real" answer.
- Usage metering written to UsageRecord; free-tier daily message limit enforced server-side (configurable, default 30).

Streaming: SSE (`text/event-stream`) from the messages endpoint; both web and RN clients parse it; abort signal allows "Stop generating".

## 6. Design system — tokens (`packages/ui-tokens`)

- bg `#171717`, surface `#242424`, accent `#FFB800`, text `#F5F5F5`, muted `#A3A3A3`
- radii: 12/16/24; font: Inter (web via next/font), system defaults on RN
- Original "Astra" logo: SVG star-arc mark (gold spark in orbit ring) — drawn from scratch.

## 7. Security posture

- bcrypt password hashing via auth library; HTTP-only, SameSite=Lax session cookie; Secure in production.
- Server env validated at boot (zod); fail fast.
- Uploads: mime sniff (magic bytes), max 8 MB, stored under user-scoped keys; served through authorizing route or short-lived signed path.
- Security headers: CSP, X-Frame-Options, Referrer-Policy via next.config.
- docs/security.md lists retention, consent, deletion flows.

## 8. Testing

- Unit: usage math, prompt builder, provider mock, zod schemas (Vitest, web + packages).
- API integration: auth + isolation + rate-limit + conversation flow using a Prisma test DB (single pg instance), mock AI provider.
- Web component tests: RTL/Vitest.
- Mobile component tests: Jest + RNTL.
- E2E flow (playwright) for register → conversation → save → history using mock provider (optional to run).

## 9. Builds

- EAS profiles: `development`, `preview` (internal testing; generates **installable APK** for Android), `production` (APK/AAB + IPA when credentials exist).
- Local workerd-compatible verification runs via `wrangler dev` are **not applicable** — standard Node 22 Postgres backend.
- Apple signing/TestFlight requires Apple Developer account — documented, not claimed.

## 10. Known environment constraints (Windows host)

- Docker unavailable → local dev uses direct Postgres connection (compose file still shipped).
- No local Android SDK/Java → EAS cloud builds required for APK; download workflow verifies artifact presence before linking.
