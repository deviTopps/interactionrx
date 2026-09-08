# InteractionRX — Herbal Medicine Registry

Secure platform for registering and managing locally manufactured herbal medicines.

## Security Features

- **Role-based access control** — Admin, Regulatory Officer, Read Only
- **Audit trail** — All create, update, and delete actions are logged
- **Session timeout** — 30-minute inactivity auto-logout
- **Authorized access only** — No public self-registration
- **Row-level security** — Enforced at database level via Supabase

## User Roles

| Role | Permissions |
|------|-------------|
| `admin` | Full access + user management |
| `officer` | Create, edit, delete medicines + view audit log |
| `viewer` | Read-only access |

Promote a user to admin in Supabase SQL Editor:
```sql
UPDATE user_profiles SET role = 'admin' WHERE user_id = '<user-uuid>';
```

## Tech Stack

- **Frontend:** Next.js 15, React, TypeScript, Tailwind CSS
- **Backend:** Node.js, Express (Vercel serverless-compatible)
- **Database & Auth:** Supabase (PostgreSQL + Auth)
- **Hosting:** Vercel (two projects — frontend + API)

## Project Structure

```
├── frontend/          # Next.js app (UI) — deploy as Vercel project #1
├── backend/           # Express API — deploy as Vercel project #2
└── supabase/
    ├── schema.sql     # Core database schema
    └── security.sql   # Roles, profiles, audit logs
```

## Setup

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. In the **SQL Editor**, run:
   - `supabase/schema.sql`
   - `supabase/security.sql`
3. In **Project Settings → API**, copy:
   - Project URL
   - Publishable / `anon` key
   - `service_role` secret key

### 2. Configure Environment Variables

**Backend** — copy `backend/.env.example` to `backend/.env`:

```env
PORT=4000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
FRONTEND_URL=http://localhost:3000
```

**Frontend** — copy `frontend/.env.local.example` to `frontend/.env.local`:

```env
BACKEND_URL=http://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
NEXT_PUBLIC_API_URL=
```

Leave `NEXT_PUBLIC_API_URL` empty so the browser calls same-origin `/api`, which the Next.js proxy forwards to `BACKEND_URL`.

### 3. Install Dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 4. Run Locally

```bash
# Terminal 1 — API
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

- Frontend: http://localhost:3000
- API: http://localhost:4000

### 5. Create User Accounts

Create users in the Supabase Auth dashboard (or via Settings → Users once the service role key is set). New profiles default to `officer`.

To set an admin:
```sql
UPDATE user_profiles SET role = 'admin'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@example.com');
```

## Deploy to Vercel

Use **two Vercel projects** from the same Git repo (Express scrapers and long requests are a poor fit inside the Next.js app alone).

### A. API project (`backend/`)

1. [vercel.com/new](https://vercel.com/new) → import this repo.
2. Set **Root Directory** to `backend`.
3. Framework Preset: Other (uses `backend/vercel.json`).
4. Environment variables:

| Name | Value |
|------|--------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` / `SUPABASE_PUBLISHABLE_KEY` | anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role secret |
| `FRONTEND_URL` | `https://your-frontend.vercel.app` |
| `ALLOW_VERCEL_PREVIEWS` | `true` (optional, for preview URLs) |
| `ALLOWED_ORIGINS` | comma-separated extras (optional) |

5. Deploy, then note the API URL (e.g. `https://interactionrx-api.vercel.app`).

Run schema/security SQL in the Supabase SQL Editor before relying on the app. Production blocks `POST /api/setup/migrate*` unless `ALLOW_SETUP_MIGRATIONS=true`.

### B. Frontend project (`frontend/`)

1. Import the same repo again as a second Vercel project.
2. Set **Root Directory** to `frontend`.
3. Framework Preset: Next.js.
4. Environment variables:

| Name | Value |
|------|--------|
| `BACKEND_URL` | `https://your-api.vercel.app` (no trailing slash) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable key |
| `NEXT_PUBLIC_API_URL` | leave **empty** |

5. Deploy.

### C. Wire auth + CORS

1. Supabase → **Authentication → URL configuration**:
   - Site URL: `https://your-frontend.vercel.app`
   - Redirect URLs: add that URL and `https://*-your-team.vercel.app/**` if you use previews
2. On the API project, set `FRONTEND_URL` to the production frontend URL.
3. Redeploy both if URLs changed.

### Local vs production API calls

| Env | Browser calls | Next.js forwards to |
|-----|---------------|---------------------|
| Local / Vercel | `/api/...` (same origin) | `BACKEND_URL` |

Herb import scrape jobs may hit Vercel function time limits on Hobby (10s). Prefer Vercel Pro (`maxDuration` up to 60s in `backend/vercel.json`) or a long-running host for heavy scraping.

## Features

- **Authentication** — Email/password login via Supabase Auth
- **Dashboard** — Overview stats and recent medicines
- **Herbal Medicines** — Full CRUD for local-origin herbal medicines
  - Name, description, composition, origin
  - Multiple ingredients per medicine (name, quantity, unit, notes)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/herbal-medicines` | List all medicines |
| GET | `/api/herbal-medicines/:id` | Get one medicine |
| POST | `/api/herbal-medicines` | Create medicine |
| PUT | `/api/herbal-medicines/:id` | Update medicine |
| DELETE | `/api/herbal-medicines/:id` | Delete medicine |

All medicine endpoints require a `Bearer` token from Supabase Auth.

## Next Steps

Future modules can be added as new routes, pages, and database tables following the same pattern.
