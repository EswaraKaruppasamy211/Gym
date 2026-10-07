# Flexora

Flexora is an adaptive fitness experience with profile onboarding, personalized workouts, a workout player, activity-based coaching, recovery recommendations, a history-backed Fitness Journey, and saved workout history.

## Project layout

- `frontend/` contains the Vite/React application and static assets.
- `backendfolder/` contains the Express API and server-only PostgreSQL access.
- `data/schema.sql` creates the minimal PostgreSQL schema at API startup.

## Configure PostgreSQL

Copy `.env.example` to `.env` and set `DATABASE_URL` to the Supabase PostgreSQL connection string. `.env` files are ignored by Git. Never use a `VITE_` prefix for database credentials.

```env
DATABASE_URL=your_postgresql_connection_string_here
```

Run the frontend and backend in separate terminals:

```sh
npm install
npm run dev:backend
npm run dev
```

Vite forwards `/api` requests to the local backend on port 3001. The API reports its database status at `http://localhost:3001/api/health`. If `DATABASE_URL` is missing or PostgreSQL is unavailable, browser-backed demo accounts and localStorage data continue to work.

For a single-origin production deployment, build the frontend and start the backend:

```sh
npm run build
npm start
```

The backend serves the generated `dist/` assets and API from the same origin. Configure `DATABASE_URL` in the backend deployment environment. No deployment is performed by this project.

## Persistence and migration

- Accounts are stored with a server-side scrypt password hash; bearer session tokens are stored as hashes in PostgreSQL.
- User profiles, the active structured workout, and coach messages are saved to PostgreSQL.
- Workout history is upserted by account and workout ID, so repeat synchronization does not create duplicate entries.
- Progress and Human Visualization are still derived from real saved workout history; no separate progress table is needed.
- On login, a legacy browser account is migrated when it is absent from PostgreSQL. Existing browser data is not deleted.
- Browser localStorage remains a compatibility/offline fallback. Data created while PostgreSQL is unavailable is synchronized after a subsequent successful login.

Tables: `app_users`, `user_profiles`, `user_app_state`, `workout_history`, and `user_sessions`. The SQL is idempotent and creates missing tables/indexes without resetting existing records.

## API routes

- `GET /api/health` — connection/readiness status (never returns credentials).
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/migrate`, `POST /api/auth/logout`.
- `GET /api/me/data`, `PUT /api/me/data` — authenticated profile, current workout, chat, and workout history.

## Optional AI provider

The AI provider remains separate from PostgreSQL. To connect one, set `VITE_FLEXORA_AI_ENDPOINT` (or the legacy `VITE_FITFLOW_AI_ENDPOINT`) to a server-side AI API route. Keep provider credentials on that server, never in `VITE_*` variables. If the provider is absent or fails, Flexora continues using its local adaptive workout engine.
