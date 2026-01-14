# Supabase Migration & Seeding Steps

Follow these steps to finalize database + auth integration.

## 1. Apply Schema Migration
File: `supabase/migrations/001_create_schema.sql`

Steps:
1. Open Supabase Dashboard → SQL Editor.
2. Copy entire contents of the migration file.
3. Paste into a new query tab and Execute.
4. Confirm tables created:
   - projects, runs, variants, prompts, exports, dfx_summaries
5. Confirm Row Level Security (RLS) enabled for all tables (toggle shows ON).
6. In Auth → Policies or Table editor, verify policies exist (search by names beginning "Users can ...").

## 2. Auth Configuration
Dashboard → Authentication → Settings:
- Site URL: `http://localhost:3000` (or the port you actually use).
- Additional Redirect URLs: include `http://localhost:3000/auth/callback`.
- (Optional) Enable Auto-confirm email for local development.

## 3. Environment Variables Recap
Web (`apps/web/.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=https://dvgdxiwmelgwcpdhzemy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
NEXT_PUBLIC_DISABLE_AUTH=false
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
```
API (`apps/api/.env`): service role key present; do NOT expose service role in web env.

## 4. Seeding Demo Data
Use existing script: `apps/api/seed_supabase.py`.
```
cd apps/api
python seed_supabase.py dev@example.com DevPass123!
```
What it does:
- Creates (or reuses) a user.
- Inserts a deterministic project ("Demo Project").
- Inserts a run for that project.

If it fails:
- Ensure service role key (`SUPABASE_KEY`) is correct.
- Ensure you copied the SQL migration first (tables must exist).

## 5. Manual Testing Flow
1. Sign up / sign in in web app.
2. Create a project from UI → should POST to FastAPI and/or Supabase depending on configuration.
3. Trigger a run (generate) → verify run row appears in `runs` table (status transitions to `completed`).
4. Check variants endpoint: `GET /api/v1/runs/<run_id>/variants` returns data; if Supabase configured, confirms variant insertion.
5. Export presign: POST `/api/v1/exports/presign` returns signed or stub URL.

## 6. Common Issues
| Symptom | Cause | Fix |
|---------|-------|-----|
| Sign-in still shows config warning | Placeholder anon key not replaced | Update `.env.local` and restart dev server |
| 401 on sign-in | Wrong anon key or service role misused | Use anon public key only in web env |
| 404 tables in Supabase REST | Migration not applied | Apply `001_create_schema.sql` |
| Policies deny access | Missing auth user id / email not confirmed | Enable auto-confirm or confirm email |
| RLS errors on insert | Policies missing or user not owner | Re-run migration; check user id matches inserted project.user_id |

## 7. Next Steps (Optional Enhancements)
- Add Playwright tests for auth and project creation.
- Enable CAD/FEM pipelines (set CAD_ENABLED=1 / FEM_ENABLED=1) after adding logic.
- Add MLflow tracking URI and verify metrics ingestion.

## 8. Rollback Strategy
If migration needs rollback during development:
- Drop tables manually (projects first will fail due to dependencies; drop child tables first: dfx_summaries, exports, prompts, variants, runs, projects).
- Re-run the migration SQL.

## 9. Production Considerations
- Use HTTPS site URL (enforced by config schema in production builds).
- Do not commit service role key.
- Rotate keys periodically (Supabase Settings → API → Rotate). Update both API `.env` and any CI secrets.

## 10. Verifying Policies Quickly
Run in SQL Editor:
```sql
SELECT tablename, relrowsecurity
FROM pg_catalog.pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('projects','runs','variants','prompts','exports','dfx_summaries');
```
`relrowsecurity` must be `t` for all.

---
If you need automation of migrations via CLI later:
```
npm install -g supabase
supabase login
supabase link --project-ref dvgdxiwmelgwcpdhzemy
supabase db push  # applies local diff (requires init structure)
```
(Starter uses direct SQL file; CLI push is optional.)
