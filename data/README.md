# Data

`schema.sql` is the PostgreSQL schema applied idempotently by the backend. It stores account hashes/sessions, user profiles, current app state (active workout and coach messages), and workout history. Progress and Human Visualization are derived from workout history and are not duplicated into separate tables.

Keep connection strings and production data out of this folder and source control. Set `DATABASE_URL` in the backend environment.
