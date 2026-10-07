# Backend

This project does not currently include a backend server. The browser app can connect to a server-side AI endpoint using `VITE_FLEXORA_AI_ENDPOINT` (or the legacy `VITE_FITFLOW_AI_ENDPOINT`), but provider credentials must remain on that server and must never be placed in frontend environment variables.

Place future API routes, server configuration, and server-only secrets management in this folder.
