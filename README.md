# Alessence Optimized — Backend Phase

Standalone Next.js 16 backend for source-grounded exam generation. The original
`C:\Programming\Alessence` project is unchanged. Frontend implementation is
intentionally paused.

## Setup

1. Copy `.env.example` to `.env.local` and set all required values.
2. Run `pnpm install`.
3. Run `pnpm db:deploy` against a backup or staging copy first.
4. Run `pnpm dev`.
5. In a second terminal, run `pnpm dev:inngest` for local durable workflows.
6. Open the Inngest dashboard at `http://localhost:8288`.

The only permitted login is `ALLOWED_USER_EMAIL`, which must already exist in
the migrated `User` table.

## Verification

```text
pnpm typecheck
pnpm test
pnpm lint
pnpm build
```

## Backend boundaries

- `/api/auth/login`, `/api/auth/logout`
- `/api/materials`
- `/api/exams`, `/api/exams/mock`, `/api/exams/quiz`
- `/api/exams/:id`, status, retry, attempts, history, comparison, wrong answers
- `/api/attempts/:attemptId`, `/api/attempts/:attemptId/abandon`
- `/api/inngest`
- `/api/health`

Never apply the migration to the only production database without a verified
backup. Uploaded material is public-addressed by Vercel Blob as in the original
application; use a private storage strategy before handling confidential data.
