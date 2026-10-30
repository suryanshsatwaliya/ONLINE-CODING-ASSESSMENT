# Assess / Portal

Assess / Portal is a web app for creating and taking classroom assessments. Teachers build quizzes, coding challenges, or mixed assessments, assign them to students, monitor active attempts, and review results. Students sign in with their UID and an assessment access code, then answer questions or work in the built-in code editor.

## What you can do

- Create and reuse quiz, coding, and mixed question sets.
- Assign assessments to students and schedule or start them manually.
- Monitor attempts, warnings, submissions, and remaining time.
- Review answers, code, and marks after submission.
- Run and grade coding questions through an optional Judge0-compatible sandbox.
- Use optional Cloudflare Turnstile verification for teacher sign-in and optional AI-assisted code feedback.

## Requirements

- Node.js **22.12 or newer** and npm.
- MongoDB Atlas, or a local MongoDB **replica set**. Assessments use transactions, which require replica set support.
- A code execution provider only if you want to run coding questions. Quiz assessments work without one.

## Run locally

Open the project folder in a terminal. In PowerShell, install dependencies and create the server environment file:

```powershell
cd server
npm ci
Copy-Item .env.example .env
```

On macOS or Linux, use `cp .env.example .env` instead of `Copy-Item`.

Edit `server/.env` and set:

- `MONGODB_URI` to your MongoDB connection string. Use the `quiz_portal` database name.
- `JWT_SECRET` to a random string of at least 32 characters.
- `SEED_TEACHER_NAME`, `SEED_TEACHER_EMAIL`, and `SEED_TEACHER_PASSWORD` for the first teacher account. The password must be at least 12 characters.
- Keep `PORT=5000` and `CLIENT_URL=http://localhost:5173` for the default local setup.

Generate a JWT secret in PowerShell with:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Create the initial teacher account and start the API:

```powershell
npm run seed
npm run dev
```

The API runs at `http://localhost:5000`; its health check is `http://localhost:5000/api/health`.

Open a **second terminal** from the project folder and start the client:

```powershell
cd client
npm ci
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173`. The client `.env.example` points to the local API and Socket.IO server. Keep both terminals running; press **Ctrl+C** in each terminal to stop a server.

## First assessment

1. Sign in to the Teacher Workspace using the credentials set in `server/.env`.
2. Add students and create or import questions in the Question Bank.
3. Create an assessment, choose its format and questions, set its rules, and assign students.
4. Generate an assessment access code and share it with assigned students.
5. Start the assessment. Students sign in with their UID and the access code, then join the attempt.
6. Use Live Monitor to view attempts. After students submit, review their answers and results in Submissions & results.

## Optional integrations

**Code execution:** Set `CODE_RUNNER_URL` and the provider credentials in `server/.env` for a trusted Judge0-compatible sandbox. The server does not execute student code itself. Without a configured runner, the code editor remains available but Run Code cannot execute submissions.

**Teacher sign-in verification:** Set both `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` in `server/.env` to enable Cloudflare Turnstile. Leave both empty to disable it.

**AI feedback:** Set `AI_API_URL`, `AI_API_KEY`, and `AI_MODEL` in `server/.env` to enable an OpenAI-compatible chat-completions provider. AI feedback is optional and requires teacher review.

Never put server secrets in client environment variables or commit real credentials.

## Deployment

- **Client:** Deploy `client` to Vercel with the Vite build command `npm run build` and output directory `dist`. Set `VITE_API_URL` to the deployed API URL ending in `/api`, and `VITE_SOCKET_URL` to the API origin. `client/vercel.json` provides SPA route rewrites.
- **API:** Deploy `server` as a persistent Node web service on Render. The provided `render.yaml` is a starting Blueprint. Configure `MONGODB_URI`, `JWT_SECRET`, and `CLIENT_URL` in the service environment; add optional provider credentials only when needed.
- **Database:** Use MongoDB Atlas and allow the API host to connect. Keep development and production databases separate.

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md), [docs/CODE_EXECUTION.md](docs/CODE_EXECUTION.md), and [docs/SECURITY.md](docs/SECURITY.md) for detailed deployment, runner, and security guidance.

## Useful commands

Run these from the relevant folder:

| Folder | Command | Purpose |
| --- | --- | --- |
| `server` | `npm run dev` | Start the development API |
| `server` | `npm run seed` | Create the initial teacher and sample data |
| `server` | `npm test` | Run backend tests |
| `client` | `npm run dev` | Start the Vite development server |
| `client` | `npm run build` | Build the client for deployment |

## Troubleshooting

- **MongoDB connection or DNS error:** Check the URI, database username/password, Atlas network access, and cluster status. A standalone local MongoDB server is not sufficient; use Atlas or a replica set.
- **Teacher sign-in fails:** Confirm the email/password in the database. The seed command does not overwrite an existing teacher password.
- **Student cannot join:** Confirm the UID is active and assigned to the assessment, and that the access code is current.
- **Run Code is unavailable:** Configure a compatible code runner and verify the provider's language IDs and credentials.
- **Port is already in use:** Stop the previous process or change `PORT` and update the client API/socket URLs and `CLIENT_URL` to match.

## Security note

Browser monitoring is best-effort. A web page cannot reliably detect all extensions, prevent operating-system app switching, block screenshots, or prove a student's identity. Use institutional sign-in and appropriate supervision for higher-assurance exams.
