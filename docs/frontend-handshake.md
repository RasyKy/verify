# Frontend ↔ Backend handshake

**For:** Ky Rasy (frontend) · **From:** Chhay Lyhour (backend)

> **⚠️ Superseded — kept for the reasoning, not the instructions.**
>
> This was written when the Nuxt pages still called `/api/*` directly. Commit
> `f09e5a0` replaced those calls with `useXMockData()` composables, so the
> endpoint table in "Problem 1" describes call sites that no longer exist.
>
> **The integration has since been done.** What actually shipped:
>
> - `frontend/.env` now exists (its absence made every page 500 during SSR —
>   `@nuxtjs/supabase` throws when constructing the server client).
> - **No `/api/**` proxy.** The proxy proposed below collides with the app's own
>   Nitro handlers under `server/api/`. `useApi()` sets an explicit `baseURL`
>   from `runtimeConfig.public.apiBase` instead; the backend's CORS allowlist
>   already permits `localhost:3000` with `Authorization`, and bearer auth gains
>   nothing from being same-origin.
> - `app/composables/useApi.ts` and `useMe.ts` were added; `useIssuerMockData`
>   and `useVerifyMockData` are gone, replaced by `useCertificates.ts`.
> - The route guard is enabled and now checks **role**, via `GET /api/auth/me`.
> - `/api/auth/me` gained a `fullName` field.
>
> Still mock-backed: the recipient dashboard and the whole admin portal
> (`useRecipientMockData`, `useAdminMockData`), plus the three temporary Nitro
> handlers in `frontend/server/api/`.
>
> Current contract: [api-schema.md](./api-schema.md). Current status:
> [backend-progress.md](./backend-progress.md).

Two problems block every API call in the app today. Both fix in one small
change on the frontend side; nothing else about the pages needs to move.

## Problem 1 — every `/api/*` call 404s

The app calls same-origin relative paths:

| Call site | Endpoint |
| --- | --- |
| [pages/issuer/index.vue:15](../frontend/app/pages/issuer/index.vue#L15) | `GET /api/dashboard?range=30d` |
| [pages/issuer/certificates.vue:23](../frontend/app/pages/issuer/certificates.vue#L23) | `GET /api/certificates` |
| [components/issuer/CertificateForm.vue:95](../frontend/app/components/issuer/CertificateForm.vue#L95) | `GET /api/courses` |
| [CertificateForm.vue:116](../frontend/app/components/issuer/CertificateForm.vue#L116) | `POST /api/courses` |
| [CertificateForm.vue:137](../frontend/app/components/issuer/CertificateForm.vue#L137) | `PUT /api/certificates/:id` |
| [CertificateForm.vue:149](../frontend/app/components/issuer/CertificateForm.vue#L149) | `POST /api/certificates` |
| [RevokeConfirmModal.vue:25](../frontend/app/components/issuer/RevokeConfirmModal.vue#L25) | `POST /api/certificates/:id/revoke` |
| [pages/verify/[certId].vue:27](../frontend/app/pages/verify/[certId].vue#L27) | `GET /api/certificates/verify/:certId` |

There is no `frontend/server/api/` directory and no `runtimeConfig.public.apiBase`,
so nothing routes these anywhere. They all return 404 — which is why `/issuer`
renders with empty stats and an empty table.

## Problem 2 — no auth token reaches the backend

`login.vue` signs in directly against Supabase and the session lands in a
cookie. But `useFetch('/api/…')` sends no `Authorization` header, so the backend
cannot tell who is calling and correctly answers 401 on every protected route.

Keeping direct Supabase sign-in is the right call — supabase-js already handles
token storage, rotation and refresh, and re-implementing that in Express would
be a weaker copy. The backend only needs the token forwarded.

## The fix — two files

### 1. `nuxt.config.ts` — proxy `/api/**` to Express

Keeps every existing path working unchanged and avoids CORS in development
entirely, since the browser only ever talks to `localhost:3000`.

```ts
export default defineNuxtConfig({
  // …existing config…
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001',
    },
  },
  routeRules: {
    '/': { prerender: true },
    '/api/**': {
      proxy: `${process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001'}/api/**`,
    },
  },
})
```

Add `NUXT_PUBLIC_API_BASE` to `frontend/.env` (pointing at the Railway URL in
production). Note `frontend/.env` does not exist yet and `@nuxtjs/supabase`
will not boot without it:

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_KEY=<anon-public-key>
NUXT_PUBLIC_API_BASE=http://localhost:3001
```

### 2. `app/composables/useApi.ts` — attach the bearer token

```ts
/**
 * $fetch instance that forwards the Supabase access token to the backend.
 * Works during SSR too: @nuxtjs/supabase reads the session cookie server-side,
 * so useFetch on the issuer pages is authenticated on the first render.
 */
export function useApi() {
  const session = useSupabaseSession()

  return $fetch.create({
    onRequest({ options }) {
      const token = session.value?.access_token
      if (token) options.headers.set('Authorization', `Bearer ${token}`)
    },
    onResponseError({ response }) {
      // Session expired or revoked — bounce to login rather than showing an
      // empty table with no explanation.
      if (response.status === 401) navigateTo('/login')
    },
  })
}
```

Then at each call site, swap the fetcher. For `$fetch`:

```ts
// before
await $fetch('/api/certificates', { method: 'POST', body })
// after
const api = useApi()
await api('/api/certificates', { method: 'POST', body })
```

For `useFetch`, pass it as `$fetch`:

```ts
const { data, pending, refresh } = useFetch<Certificate[]>('/api/certificates', {
  $fetch: useApi(),
  default: () => [],
})
```

**Public endpoints need no change at all** — `GET /api/certificates/verify/:certId`,
`/api/registry` and `/api/certificates/:id/qr` are unauthenticated by design
(FR-AUTH-04, FR-VERIFY-05), so `verify/[certId].vue` can keep plain `useFetch`.

## Three response-shape details, so nothing surprises you

**1. Casing is asymmetric, and I matched what you already wrote rather than
changing it.** `GET /api/certificates` returns **snake_case** (`student_name`,
`completion_date`, `expiry_date`, `issued_at`, `revoked_at`) because that is
what `certificates.vue` destructures. `POST`/`PUT` bodies and the verify
response are **camelCase** (`studentName`, `issuedAtBlockchainTimestamp`). Say
the word if you would rather I normalise both to camelCase — it is a small
change on my side, but it would mean edits across your table and modals.

**2. `status` is computed server-side, and there is no `claimed` value.** Your
union is `'valid' | 'revoked' | 'expired' | 'unclaimed'`, and `statusConfig` has
no `claimed` key — so a claimed, still-valid certificate comes back as `valid`.
Claim state is tracked separately in the database and derived on read, so a
certificate flips to `expired` the day after its expiry date with no job needing
to run.

**3. Errors arrive as `{ error: { code, message, requestId }, message }`.** The
top-level `message` is duplicated deliberately so your existing
`err?.data?.message ?? 'Something went wrong'` toasts show the real reason.
Validation failures also carry `error.fieldErrors` as
`{ fieldName: [messages] }` if you want to highlight the offending input.

## Two things on your side I noticed while reviewing

- **The route guard is disabled.** [middleware/auth.global.ts](../frontend/app/middleware/auth.global.ts)
  is a commented-out stub, so `/issuer` and `/admin` are open to anyone. The
  backend rejects unauthorised *data* requests regardless, so this is not a data
  leak — but an unauthenticated visitor currently sees the full shell. The
  `/admin` guard also needs a role check, not just a signed-in check; `/api/auth/me`
  returns `{ role, organization }` for exactly that.
- **`user_metadata.institution_name` is fine for display, never for authz.**
  `user_metadata` is writable by the user through `auth.updateUser()`. Roles live
  in `app_metadata`, which only the backend can write, and the API re-checks
  against the `profiles` table on every request — so nothing breaks if that
  field is edited. Just don't branch on it for anything that grants access.

## Also worth knowing

- `frontend/assets/css/main.css` is a dead 2-line stub; the live one is
  `frontend/app/assets/css/main.css` (which `nuxt.config.ts` resolves via `~`).
- `CertificateDetailModal.vue` links to `/cert/:id`, which does not exist yet.
  The holder portal and claim page are unbuilt — my `/api/holder/*` and
  `/api/claims/*` endpoints will be ready and documented in
  [docs/api-schema.md](./api-schema.md) whenever you get to them.
- Nobody generates QR codes yet — the app only has `qr-scanner`, which reads
  them. I'm serving `GET /api/certificates/:id/qr` as a PNG so you can point an
  `<img>` at it; it encodes `${FRONTEND_URL}/verify/${id}`, which is exactly
  what `QrScannerModal.vue` already parses.
