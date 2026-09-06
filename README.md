# BetterHuman — AI Reflections Journal

A Next.js 16 journaling app with Firebase Authentication, owner-isolated Firestore data, BYOK AI providers, one consolidated Live Voice experience, and a production Cloud Run configuration.

## What is supported

- Google Gemini (recommended): reflections, summaries, transcription, and Gemini voice.
- OpenAI, Anthropic, and OpenRouter: reflections and summaries; voice playback falls back to browser speech.
- Provider keys live only in the current tab's JavaScript memory. They are never written to cookies, browser storage, Firestore, environment files, or logs.
- Firebase Google Authentication and per-user journal storage.
- One Live Voice launcher in the navigation bar. Inline dictation is a separate speech-to-text input aid.
- Authenticated, rate-limited API routes with bounded request sizes.

## Local setup

Requirements: Node.js 20 or 22 and npm.

```bash
cp .env.example .env.local
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Fill the Firebase values in `.env.local`. This file is ignored by Git and Docker.

Before Google sign-in can work, add these domains in **Firebase Console → Authentication → Settings → Authorized domains**:

- `localhost`
- `betterhuman.ai.studio`
- the generated `*.run.app` Cloud Run hostname

## Firebase configuration and repository safety

Firebase web configuration is intentionally public in every browser application; the API key identifies the Firebase project but does not authorize Firestore access. Security must come from:

1. Firestore rules and Firebase Auth.
2. Google Cloud API-key restrictions limited to required Firebase APIs.
3. Website restrictions for approved production origins.
4. Never using a Firebase web key as a server credential.

This repository contains placeholders only. Real local values belong in ignored `.env.local`; Cloud Run values are provided at build/runtime.

Run a pre-publish check:

```bash
git check-ignore .env.local
git status --short
rg -n --hidden -uu --glob '!.git/**' --glob '!node_modules/**' --glob '!.next/**' --glob '!.env.local' \
  '(AIza[0-9A-Za-z_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|sk-[A-Za-z0-9_-]{20,})' .
```

## Verification

```bash
npm run lint
npm run build
npm audit --omit=dev
curl -fsS http://localhost:3000/api/health
```

Expected security behavior:

- `GET /api/health` returns HTTP 200.
- Protected API calls without a Firebase ID token return HTTP 401.
- AI-provider failures return sanitized messages without provider keys or SDK payloads.

## Cloud Run deployment

The checked-in [cloudbuild.yaml](./cloudbuild.yaml) builds a standalone container and deploys:

- region: `asia-southeast1`
- service: `gemini-reflections-journal`
- 1 vCPU / 1 GiB RAM
- concurrency: 40
- min instances: 1
- max instances: 10
- request timeout: 300 seconds

Authenticate and select the project:

```bash
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

Load local environment values and submit:

```bash
set -a
source .env.local
set +a

gcloud builds submit --config cloudbuild.yaml \
  --substitutions=_APP_URL=https://betterhuman.ai.studio,_FIREBASE_API_KEY="$NEXT_PUBLIC_FIREBASE_API_KEY",_FIREBASE_PROJECT_ID="$NEXT_PUBLIC_FIREBASE_PROJECT_ID",_FIREBASE_APP_ID="$NEXT_PUBLIC_FIREBASE_APP_ID",_FIREBASE_AUTH_DOMAIN="$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",_FIRESTORE_DATABASE_ID="$NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID",_FIREBASE_STORAGE_BUCKET="$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",_FIREBASE_MESSAGING_SENDER_ID="$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
```

Operational secrets such as `GOOGLE_MAPS_API_KEY`, `SLACK_WEBHOOK_URL`, `DISCORD_WEBHOOK_URL`, and `GMAIL_NOTIFICATION_WEBHOOK` must be attached from Secret Manager. Never prefix them with `NEXT_PUBLIC_`.

If the custom domain is not mapped:

```bash
gcloud beta run domain-mappings create \
  --service gemini-reflections-journal \
  --domain betterhuman.ai.studio \
  --region asia-southeast1
```

## Production checks

```bash
curl -fsS https://betterhuman.ai.studio/api/health
curl -I https://betterhuman.ai.studio
```

Also verify:

- Google sign-in succeeds on both the Cloud Run URL and custom domain.
- Firestore owner rules deny cross-user reads and writes.
- AI Providers → **Input free key** opens [Google AI Studio API Keys](https://aistudio.google.com/api-keys).
- The navigation contains exactly one Live Voice launcher.
- Cloud Run has a ready revision, min instances 1, max instances 10, and concurrency 40.

## Important operational note

“Zero bugs” cannot be guaranteed by a static audit. This project is configured for a 100-user target, but release confidence still requires authenticated end-to-end tests, Firebase rule tests, Cloud Run monitoring, quota alerts, and a short load test against the deployed revision.
