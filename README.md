![Makerkit - Next.js Supabase SaaS Starter Kit \[Lite version\]](apps/web/public/images/makerkit.webp)

# NEW! Next.js Supabase SaaS Starter Kit (Lite)

## This Workspace (Web + API)

This repo is used as a monorepo with:

- `apps/web`: Next.js web UI (runs on `http://localhost:3000`)
- `apps/api`: FastAPI backend (runs on `http://127.0.0.1:8000`)

### Quick start (Windows)

1) Install JS deps (from repo root):

```bash
pnpm install
```

2) Start the web app:

```bash
pnpm --filter web dev
```

3) Start the API (in a separate terminal):

```powershell
cd apps/api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

### Environment variables

- Web (typically in `apps/web/.env.local`):
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

- API (typically in `apps/api/.env`):
    - `SUPABASE_URL`
    - `SUPABASE_KEY` (service role; never expose to the browser)
    - `SUPABASE_ANON_KEY` (optional)
    - `HF_TOKEN` (optional, if using Hugging Face)

### Health checks

- API readiness: `GET http://127.0.0.1:8000/api/v1/readiness`

If you need more API details (endpoints, Supabase setup), see `apps/api/README.md`.

Start building your SaaS faster with our Next.js 15 + Supabase starter kit.

👉 **Looking for a full-featured SaaS Starter Kit?** [Check out the complete version](https://makerkit.dev)

⭐️ **Why Developers Trust Makerkit:**
- Production-grade architecture decisions
- Comprehensive TypeScript setup
- Modern stack: Next.js 15, Supabase, TailwindCSS v4
- Quality Code tooling: ESLint v9, Prettier, strict TypeScript, etc.
- Regular updates and active maintenance

PS: the documentation for this kit is still being updated, so please check back later for more details.

## What's Included

### Core Architecture
- 🏗️ Next.js 15 + Turborepo monorepo setup
- 🎨 Shadcn UI components with TailwindCSS v4
- 🔐 Supabase authentication & basic DB
- 🌐 i18n translations (client + server)
- ✨ Full TypeScript + ESLint v9 + Prettier configuration

### Key Features
- 👤 User authentication flow
- ⚙️ User profile & settings
- 📱 Responsive marketing pages
- 🔒 Protected routes
- 🎯 Basic test setup with Playwright

### Technologies

This starter kit provides core foundations:

🛠️ **Technology Stack**:
- [Next.js 15](https://nextjs.org/): A React-based framework for server-side rendering and static site generation.
- [Tailwind CSS](https://tailwindcss.com/): A utility-first CSS framework for rapidly building custom designs.
- [Supabase](https://supabase.com/): A realtime database for web and mobile applications.
- [i18next](https://www.i18next.com/): A popular internationalization framework for JavaScript.
- [Turborepo](https://turborepo.org/): A monorepo tool for managing multiple packages and applications.
- [Shadcn UI](https://shadcn.com/): A collection of components built using Tailwind CSS.
- [Zod](https://github.com/colinhacks/zod): A TypeScript-first schema validation library.
- [React Query](https://tanstack.com/query/v4): A powerful data fetching and caching library for React.
- [Prettier](https://prettier.io/): An opinionated code formatter for JavaScript, TypeScript, and CSS.
- [Eslint](https://eslint.org/): A powerful linting tool for JavaScript and TypeScript.
- [Playwright](https://playwright.dev/): A framework for end-to-end testing of web applications.

This kit is a trimmed down version of the [full version of this SaaS Starter Kit](https://makerkit.dev). It is a good way to evaluate small part of the full kit, or to simply use it as a base for your own project.

## Comparing Lite vs Full Version

The lite kit is perfect for:
- Evaluating our code architecture and patterns
- Building basic SaaS prototypes
- Learning our tech stack approach
- Building a basic SaaS tool

The [full version](https://makerkit.dev) adds production features:
- 💳 Complete billing and subscription system
- 👥 Team accounts and management
- 📧 Mailers and Email Templates (Nodemailer, Resend, etc.)
- 📊 Analytics (GA, Posthog, Umami, etc.)
- 🔦 Monitoring providers (Sentry, Baselime, etc.)
- 🔐 Production database schema
- ✅ Comprehensive test suite
- 🔔 Realtime Notifications
- 📝 Blogging system
- 💡 Documentation system
- ‍💻 Super Admin panel
- 🕒 Daily updates and improvements
- 🐛 Priority bug fixes
- 🤝 Support
- ⭐️ Used by 1000+ developers
- 💪 Active community members
- 🏢 Powers startups to enterprises

[View complete feature comparison →](https://makerkit.dev/#pricing)

## Getting Started

### Prerequisites

- Node.js 18.x or later (preferably the latest LTS version)
- Docker
- PNPM

Please make sure you have a Docker daemon running on your machine. This is required for the Supabase CLI to work.

### Installation

#### 1. Clone this repository

```bash
git clone https://github.com/makerkit/next-supabase-saas-kit-lite.git
```

#### 2. Install dependencies

```bash
pnpm install
```

#### 3. Start Supabase

Please make sure you have a Docker daemon running on your machine.

Then run the following command to start Supabase:

```bash
pnpm run supabase:web:start
```

Once the Supabase server is running, please access the Supabase Dashboard using the port in the output of the previous command. Normally, you find it at [http://localhost:54323](http://localhost:54323).

You will also find all the Supabase services printed in the terminal after the command is executed.

##### Stopping Supabase

To stop the Supabase server, run the following command:

```bash
pnpm run supabase:web:stop
```

##### Resetting Supabase

To reset the Supabase server, run the following command:

```bash
pnpm run supabase:web:reset
```

##### More Supabase Commands

For more Supabase commands, see the [Supabase CLI documentation](https://supabase.com/docs/guides/cli).

```
# Create new migration
pnpm --filter web supabase migration new <name>

# Link to Supabase project
pnpm --filter web supabase link

# Push migrations
pnpm --filter web supabase db push
```

#### 4. Start the Next.js application

```bash
pnpm run dev
```

The application will be available at http://localhost:3000.

#### 5. Code Health (linting, formatting, etc.)

To format your code, run the following command:

```bash
pnpm run format:fix
```

To lint your code, run the following command:

```bash
pnpm run lint
```

To validate your TypeScript code, run the following command:

```bash
pnpm run typecheck
```

Turborepo will cache the results of these commands, so you can run them as many times as you want without any performance impact.

## Project Structure

The project is organized into the following folders:

```
apps/
├── web/                  # Next.js application
│   ├── app/             # App Router pages
│   │   ├── (marketing)/ # Public marketing pages
│   │   ├── auth/        # Authentication pages
│   │   └── home/        # Protected app pages
│   ├── supabase/        # Database & migrations
│   └── config/          # App configuration
│
packages/
├── ui/                  # Shared UI components
└── features/           # Core feature packages
    ├── auth/           # Authentication logic
    └── ...
```

## Testing

- Guide de tests pour l'API : `apps/api/TESTING.md` (exécution locale, runner isolé,
  variables d'environnement utiles). Voir ce fichier pour les commandes PowerShell prêtes à l'emploi.

- Contributing guide: `CONTRIBUTING.md` (how to set up dev environment, run tests, and open PRs).



For more information about this project structure, see the article [Next.js App Router: Project Structure](https://makerkit.dev/blog/tutorials/nextjs-app-router-project-structure).

### Environment Variables

You can configure the application by setting environment variables in the `.env.local` file.

Here are the available variables:

| Variable Name | Description | Default Value |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | The URL of your SaaS application | `http://localhost:3000` |
| `NEXT_PUBLIC_PRODUCT_NAME` | The name of your SaaS product | `Makerkit` |
| `NEXT_PUBLIC_SITE_TITLE` | The title of your SaaS product | `Makerkit - The easiest way to build and manage your SaaS` |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | The description of your SaaS product | `Makerkit is the easiest way to build and manage your SaaS. It provides you with the tools you need to build your SaaS, without the hassle of building it from scratch.` |
| `NEXT_PUBLIC_DEFAULT_THEME_MODE` | The default theme mode of your SaaS product | `light` |
| `NEXT_PUBLIC_THEME_COLOR` | The default theme color of your SaaS product | `#ffffff` |
| `NEXT_PUBLIC_THEME_COLOR_DARK` | The default theme color of your SaaS product in dark mode | `#0a0a0a` |
| `NEXT_PUBLIC_SUPABASE_URL` | The URL of your Supabase project | `http://127.0.0.1:54321` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The anon key of your Supabase project | ''
| `SUPABASE_SERVICE_ROLE_KEY` | The service role key of your Supabase project | ''

## Architecture

This starter kit uses a monorepo architecture.

1. The `apps/web` directory is the Next.js application.
2. The `packages` directory contains all the packages used by the application.
3. The `packages/features` directory contains all the features of the application.
4. The `packages/ui` directory contains all the UI components.

For more information about the architecture, please refer to the [Makerkit blog post about Next.js Project Structure](https://makerkit.dev/blog/tutorials/nextjs-app-router-project-structure).

### Marketing Pages

Marketing pages are located in the `apps/web/app/(marketing)` directory. These pages are used to showcase the features of the SaaS and provide information about the product.

### Authentication

Authenticated is backed by Supabase. The `apps/web/app/auth` directory contains the authentication pages, however, the logic is into its own package `@kit/auth` located in `packages/features/auth`.

This package can be used across multiple applications.

### Gated Pages

Gated pages are located in the `apps/web/app/home` directory. Here is where you can build your SaaS pages that are gated by authentication.

### Database

The Supabase database is located in the `apps/web/supabase` directory. In this directory you will find the database schema, migrations, and seed data.

#### Creating a new migration
To create a new migration, run the following command:

```bash
pnpm --filter web supabase migration new --name <migration-name>
```

This command will create a new migration file in the `apps/web/supabase/migrations` directory. 

#### Applying a migration

Once you have created a migration, you can apply it to the database by running the following command:

```bash
pnpm run supabase:web:reset
```

This command will apply the migration to the database and update the schema. It will also reset the database using the provided seed data.

#### Linking the Supabase database

Linking the local Supabase database to the Supabase project is done by running the following command:

```bash
pnpm --filter web supabase db link
```

This command will link the local Supabase database to the Supabase project.

#### Pushing the migration to the Supabase project

After you have made changes to the migration, you can push the migration to the Supabase project by running the following command:

```bash
pnpm --filter web supabase db push
```

This command will push the migration to the Supabase project. You can now apply the migration to the Supabase database.

## API Prototype Extensions (Generative Design / RBAC / JWT)

The repository includes an experimental FastAPI backend (in `apps/api`) with optional JWT authentication and rate limiting for a future generative design pipeline.

### Additional Environment Variables (Backend)
| Variable | Purpose | Notes |
|----------|---------|-------|
| `SUPABASE_URL` | PostgREST base URL | Enables remote persistence for runs/projects/variants |
| `SUPABASE_KEY` | Service role key | Used for PostgREST and storage signing |
| `SUPABASE_STORAGE_BUCKET` | Storage bucket name | For export artifacts (presign stub) |
| `SUPABASE_STRICT` | Fail fast on Supabase errors (`1`/`0`) | When `1`, run creation returns 502 on persistence failure |
| `API_KEY_REQUIRED` | Enforce `X-API-Key` header | Legacy simple auth (set with `API_KEY_VALUE`) |
| `API_KEY_VALUE` | Static API key value | Used only when `API_KEY_REQUIRED=1` |
| `RATE_LIMIT_WINDOW_SECONDS` | Rate limit window length | Default `60` |
| `RATE_LIMIT_MAX_REQUESTS` | Max POST requests per window | Default `30` |
| `JWT_REQUIRED` | Enforce JWT bearer auth | When `1`, `Authorization: Bearer <token>` is mandatory |
| `SUPABASE_JWT_SECRET` | HS256 secret for JWT verify | Must match Supabase JWT secret for local tokens |
| `DIFFUSION_IMAGE_URL` | External diffusion service URL | Optional, returns inline base64 image |
| `REDIS_URL` | Redis connection string | Enables Redis-based rate limiting; use `fakeredis://localhost` for tests |
| `MLFLOW_TRACKING_URI` | MLflow tracking backend | e.g. `file:./mlruns` for local dev |
| `DIFFUSION_SERVICE_URL` | Base URL of diffusion microservice | Points to `apps/diffusion` deployment |

### RBAC Roles
When JWT auth is enabled, the backend expects a `role` claim in the token. Supported roles (prototype): `admin`, `designer`, `engineer`, `reviewer`, `reader`.

| Endpoint | Required Roles |
|----------|----------------|
| `POST /api/v1/projects` | `admin`, `designer` |
| `POST /api/v1/runs` | `admin`, `designer`, `engineer` |
| `POST /api/v1/diffusion/generate` | `admin`, `designer`, `engineer` |

### Generating a Test JWT
Use PyJWT (installed via `apps/api/requirements.txt`):
```python
import jwt
token = jwt.encode({'sub': 'user-123', 'role': 'designer'}, 'YOUR_DEV_SUPABASE_JWT_SECRET', algorithm='HS256')
print(token)
```
Send with header: `Authorization: Bearer <token>`.

### Multitenant & RBAC Schema (Supabase)
New migration adds:
```sql
CREATE TABLE tenants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    created_at timestamptz DEFAULT now()
);
CREATE TABLE user_roles (
    tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('admin','designer','engineer','reviewer','reader')),
    created_at timestamptz DEFAULT now(),
    PRIMARY KEY (tenant_id, user_id)
);
```

### Test Coverage
`apps/api/tests/test_auth_rbac.py` includes JWT + role enforcement tests (designer vs reader).

### Next Steps (Optional)
- Replace in-memory rate limit with Redis.
- Expand schema for project tenancy binding (`project.tenant_id`).
- Integrate MLflow / DVC for full run traceability.
- Implement real diffusion, 3D, FEM pipelines.
 - Add artifact logging (images/STL) to MLflow runs.
 - Deploy separate diffusion microservice (see `apps/diffusion`).


## Going to Production

#### 1. Create a Supabase project

To deploy your application to production, you will need to create a Supabase project.

#### 2. Push the migration to the Supabase project

After you have made changes to the migration, you can push the migration to the Supabase project by running the following command:

```bash
pnpm --filter web supabase db push
```

This command will push the migration to the Supabase project.

#### 3. Set the Supabase Callback URL

When working with a remote Supabase project, you will need to set the Supabase Callback URL.

Please set the callback URL in the Supabase project settings to the following URL:

`<url>/auth/callback`

Where `<url>` is the URL of your application.

#### 4. Deploy to Vercel or any other hosting provider

You can deploy your application to any hosting provider that supports Next.js.

#### 5. Deploy to Cloudflare

The configuration should work as is, but you need to set the runtime to `edge` in the root layout file (`apps/web/app/layout.tsx`).

```tsx
export const runtime = 'edge';
```

Remember to enable Node.js compatibility in the Cloudflare dashboard.

## Contributing

Contributions for bug fixed are welcome! However, please open an issue first to discuss your ideas before making a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.

## Support

No support is provided for this kit. Feel free to open an issue if you have any questions or need help, but there is no guaranteed response time, nor guarantee a fix.

For dedicated support, priority fixes, and advanced features, [check out our full version](https://makerkit.dev).

## Backend API (Extended)

This lite kit now includes a small FastAPI backend under `apps/api` which you can use for prototyping AI-assisted product generation flows.

### Core Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/health` | Basic health probe |
| POST | `/api/v1/projects` | Create a project (in-memory or Supabase) |
| GET | `/api/v1/projects` | List projects |
| GET | `/api/v1/projects/{id}` | Fetch a single project |
| POST | `/api/v1/runs` | Create a design run (background processing stub) |
| GET | `/api/v1/runs` | List runs (Supabase if configured) |
| GET | `/api/v1/runs/{run_id}` | Run detail |
| GET | `/api/v1/runs/{run_id}/variants` | List variants for run (real or synthetic) |
| GET | `/api/v1/variants/{variant_id}/detail` | Variant + DfX + prompts (404 if missing under Supabase) |
| POST | `/api/v1/exports/presign` | Stub pre-signed export URL |
| POST | `/api/v1/llm/normalize-brief` | Optional LLM brief normalization (returns 503 if not configured) |

### Additional Design & Analysis Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| GET | `/api/v1/runs/{run_id}/variants` | Synthetic + persisted variants listing |
| GET | `/api/v1/variants/{variant_id}/detail` | Variant detail (DfX summary + prompts) with LRU caching |
| POST | `/api/v1/variants/{variant_id}/feedback` | Submit user rating; updates adaptive weights + overall score |
| GET | `/api/v1/variants/{variant_id}/feedback/history` | Historical feedback entries (Supabase table `feedback_history`) |
| POST | `/api/v1/scoring/weights` | Manually override scoring weights (admin) |
| POST | `/api/v1/scoring/advanced` | Multi-objective scoring with current adaptive weights |
| GET | `/api/v1/pareto/{run_id}` | Pareto front of generated variants (multi-objective) |
| GET | `/api/v1/report/dfx/{run_id}` | Narrative DfX report summary (synthetic text) |
| POST | `/api/v1/import/variants` | Import dataset (CSV/XLSX) and generate scored variant set |
| GET | `/api/v1/fem/solve-general` | General FEM (plate) synthetic or real solver fallback |
| POST | `/api/v1/topopt/advanced-compliance` | Advanced (synthetic) compliance topology optimization iterations |
| POST | `/api/v1/exports/presign` | Pre-sign stub (supports pdf, zip, stl, step, fem-stress, cad-step, cad-stl, image) |
| GET | `/api/v1/metrics/summary` | Aggregated latency + p50/p95 per path |
| GET | `/api/v1/health/deep` | Deep integration health (Supabase, Redis, MLflow, Diffusion) |
| GET | `/admin/metrics` | Per-endpoint metrics (avg, p95) |
| GET | `/admin/kpi` | Basic KPIs (runs completion, DfX events) |
| GET | `/api/v1/scoring/weights/history` | Chronological scoring weight changes (adaptive + manual) |

### Adaptive Scoring & Feedback

User feedback on variants feeds an exponential moving average (EMA) to gently adjust aesthetic/sustainability weighting while penalizing excessive fabricability dominance. Updated weights are embedded in variant metrics and can be manually overridden via the scoring weights endpoint. Historical ratings persist in `feedback_history` and each weight drift (adaptive or manual override) is logged to `weights_history` (Supabase or in-memory fallback) and surfaced via `/api/v1/scoring/weights/history`.

`/api/v1/scoring/weights/history` supports optional filters: `run_id`, `variant_id`, `limit` (<=500), and `offset` for pagination. Example:

```bash
curl "http://localhost:8001/api/v1/scoring/weights/history?variant_id=var-123&limit=50"
```

### Variant Detail Caching

An in-memory LRU cache (`VARIANT_DETAIL_CACHE_MAX`, default 64) reduces Supabase round trips for frequently accessed variant detail pages. Disable or tune by environment variable. Weight and feedback history endpoints are not cached to ensure freshness.

### Deep Health Diagnostics

`/api/v1/health/deep` surfaces statuses for Redis, Supabase REST, MLflow tracking URI initialization, and diffusion pipeline availability. Returns `degraded` if any configured component is failing, otherwise `ok`.

### Observability

- Lightweight in-memory metrics store captures per-path latency for `/api/v1/metrics/summary`.
- Optional Prometheus instrumentation (if `prometheus_client` installed) exposed at `/metrics`.

### Roadmap (Prototype to Production)

- Replace synthetic CAD/FEM/topology stubs with real solvers.
- Longitudinal analysis dashboards on `weights_history` / `feedback_history` trends.
- Add authentication & tenant-aware isolation to all modifying endpoints.
- Introduce streaming diffusion & control-net conditioning.
- Expand health diagnostics (GPU memory, queue depth, model version).

### Environment Variables (API)

| Name | Purpose | Notes |
| ---- | ------- | ----- |
| `SUPABASE_URL` | Supabase REST URL | Enables persistence when set |
| `SUPABASE_KEY` | Service role key | Required for RLS bypass on server |
| `SUPABASE_STORAGE_BUCKET` | Storage bucket name | For signing export URLs |
| `SUPABASE_STRICT` | Fail fast on Supabase write errors | Set to `1` to disable in-memory fallback for runs |
| `DIFFUSION_IMAGE_URL` | External diffusion image generation endpoint | If set, backend will attempt inline PNG creation |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry collector endpoint | Enables tracing when present |
| `MISTRAL_API_KEY` | Mistral AI key | Enables LLM brief normalization |
| `API_KEY_REQUIRED` | Require X-API-Key header on POST | Set to `1` to enforce |
| `API_KEY_VALUE` | Expected API key value | Used when requirement enabled |
| `RATE_LIMIT_WINDOW_SECONDS` | Rate limit window length | Default `60` |
| `RATE_LIMIT_MAX_REQUESTS` | Max POST requests per window per IP | Default `30` |

If `SUPABASE_STRICT=1` is set and Supabase persistence for a run fails, the API returns HTTP 502 instead of silently falling back to in-memory storage.

### Python Version (API)

- Use Python 3.10–3.12 for the FastAPI backend. Several ML packages (e.g. `mlflow`, `torch`, `diffusers`) do not yet publish wheels for Python 3.14.
- Recommended on Windows:
    - Create a virtualenv with Python 3.12
    - Install API deps: `pip install -r apps/api/requirements.txt -r apps/api/requirements-dev.txt`

### Smoke Testing the API

A PowerShell script `tooling/scripts/smoke_api.ps1` exercises core endpoints.

Run it after starting the API server:

```powershell
cd apps/api
. .venv/Scripts/Activate.ps1
python -m uvicorn main:app --host 127.0.0.1 --port 8001
```

In a new terminal:

```powershell
pwsh -File tooling/scripts/smoke_api.ps1 -BaseUrl 'http://127.0.0.1:8001'
```

Skip run creation / variant checks:

```powershell
pwsh -File tooling/scripts/smoke_api.ps1 -SkipRun
```

### Frontend Integration

The web app auto-detects a development FastAPI backend at `http://127.0.0.1:8001` if `NEXT_PUBLIC_API_BASE_URL` is not set. To point explicitly to a remote API:

```env
NEXT_PUBLIC_API_BASE_URL=https://api.example.com
```

### Observability & Logging

Structured JSON logs are emitted by the API (`event` keys for errors). Provide an OTLP endpoint to enable tracing.

### Error Handling Improvements

Variant detail now returns:
* `404` if variant not found under Supabase.
* `503` on unexpected backend/Supabase errors.
* Synthetic placeholder only when Supabase is not configured.

Run creation under `SUPABASE_STRICT=1` fails fast (HTTP 502) on persistence errors.

### Auth & Rate Limiting (Basic)

If `API_KEY_REQUIRED=1` and `API_KEY_VALUE` are set, all POST endpoints demand `X-API-Key` header and respond with `401` on mismatch.

Simple in-memory rate limiting applies to POST endpoints (default 30 requests / 60s per client IP). Override via environment variables above. Exceeding limit returns `429`.

### Testing Additions

Added pytest file `apps/api/tests/test_strict_mode.py` covering strict run creation and missing variant detail behavior.

Added Playwright smoke tests in `apps/e2e/tests/runs-variant.spec.ts` for the runs index and synthetic variant detail page. These are non-blocking in CI (warnings only) and serve as a baseline for future expansion.

### Next Steps / Hardening Ideas

* Add authentication / JWT verification to API endpoints.
* Implement rate limiting (e.g. with Redis) for POST routes.
* Replace synthetic image/variant generation with actual pipeline.
* Add Playwright tests for the new run/variant pages.
* Add unit tests for strict mode error paths.

