# Flexora

Flexora is an adaptive fitness experience with browser-backed demo accounts, profile onboarding, structured workouts, a lightweight animated exercise player with Watch/Practice modes and form cues, in-place alternatives, activity-based coaching, recovery recommendations, a history-backed 30-day Fitness Journey map, and saved workout history.

## Project layout

- `frontend/` contains the Vite entry page, React application, styles, and static assets, including the FitLife logo.
- `backendfolder/` is reserved for a future server-side AI/API service. No backend is currently configured.
- `data/` is reserved for a future database or migrations. The current demo stores profile and workout data in browser localStorage.
- Root-level package and TypeScript configuration keeps install, build, and deploy commands straightforward.

## Run locally

```sh
npm install
npm run dev
```

Create a production build with `npm run build`.

## Optional AI provider

The app does not include a provider SDK or expose provider credentials in the browser. To connect a provider, set `VITE_FLEXORA_AI_ENDPOINT` to your own server-side API route. The existing `VITE_FITFLOW_AI_ENDPOINT` name remains supported for compatibility with earlier deployments. Keep provider secrets on that server; do not put secret values in `VITE_*` variables.

Flexora sends a `POST` request with JSON containing:

- `message`: the latest user message
- `requestedDuration`: a duration explicitly requested in the current message, or the active/preferred duration
- `profile`: name, age, goal, experience, preferred duration, and preferences
- `currentWorkout`: the active structured workout
- `history`: up to 10 stored workout records
- `conversation`: up to 12 recent chat messages

The server should return JSON with a `text` string and may return a structured `workout`:

```json
{
  "text": "A coach response",
  "workout": {
    "title": "Full body flow",
    "goal": "General Fitness",
    "duration": 20,
    "difficulty": "Moderate",
    "warmup": [{ "name": "March in place", "detail": "60 sec" }],
    "exercises": [{ "name": "Squat", "detail": "10 reps", "rest": "15 sec", "target": "Full body", "difficulty": "Moderate", "instructions": "Move with control." }],
    "cooldown": [{ "name": "Breathing reset", "detail": "60 sec" }],
    "coachMessage": "A plan tailored to your day."
  }
}
```

The app validates and normalizes structured workout responses. If the endpoint is missing, fails, or returns an invalid response, Flexora displays a friendly availability message and uses its local adaptive workout engine instead.

## Demo data and privacy

Accounts, profile details, chat, and workout history are stored in this browser's local storage for the hackathon demo. This is not production authentication or secure storage. Use a backend identity service and server-side persistence before handling real user credentials or sensitive health information.
