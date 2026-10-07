# Flexora API

The Express API in `server.mjs` owns all PostgreSQL access through the `database.mjs` connection module. It reads `DATABASE_URL` from the backend process environment (loaded from the repository-root `.env` for local development). Credentials are never returned by the health route or sent to the browser.

Run with `npm run dev:backend` for auto-reload in development or `npm start` for production. In development, Vite proxies `/api` from port 5173 to this server on port 3001. Production serves the built frontend and API on the same origin.

At startup or first database request, the API runs the idempotent statements in `data/schema.sql`. If PostgreSQL is not configured or is temporarily unreachable, the API returns a safe unavailable response; the existing browser-backed demo still works.

Passwords are stored as scrypt hashes. API sessions use random bearer tokens; only their SHA-256 hashes are persisted. Queries use PostgreSQL parameters, and stored profile data explicitly excludes its browser-only password field.
