# Quiz & Coding Assessment Portal

A JavaScript full-stack assessment application with separate teacher and student portals, MCQs, short answers, coding assessments, server-enforced deadlines, configurable browser-event monitoring, durable submissions, and teacher-reviewed AI feedback.

**Start here:** extract the ZIP, open the `quiz-assessment-portal` folder in VS Code, configure MongoDB, and follow the two-terminal instructions below. `node_modules`, build output, and real credentials are deliberately excluded. Dependency lockfiles are included.

## What is implemented

- Responsive React landing page with Student and Teacher login cards; SaaS-style teacher workspace.
- Teacher email/password login with bcrypt and scoped JWT authorization.
- Student UID lookup, identity confirmation, assigned assessment ID and hashed access code verification.
- Student CRUD, activation/deactivation, search and course/section/status filtering.
- Question bank with single choice, multiple select, true/false, exact-match short answer, and coding questions.
- Manual question authoring, reusable bank snapshots, external problem reference fields without scraping.
- Draft/scheduled/live/ended assessments, question ordering, randomization, student/course/section assignment, manual start/end and publication controls.
- Server-owned attempts, persisted randomized order, expiry times, autosave, review marks, submission and deterministic grading.
- Fullscreen/visibility/focus/clipboard monitoring; configurable rules, transactional warning increments, event idempotency and related-transition deduplication.
- Socket.IO rooms with authorization, live teacher monitor, event history, reconnect status, and REST fallback polling.
- Locally bundled Monaco editor, C/C++/Java/Python/JavaScript language configuration, visible Run Code, queued hidden-test submissions and weighted correctness marks.
- Judge0-compatible remote sandbox adapter. No student code is executed on the API server.
- Optional OpenAI-compatible chat-completions adapter with JSON validation. AI reviews require teacher approval/override, separate from correctness.
- Results, provisional grading status, teacher-only submission details, and student publication controls.
- Environment examples, seed script, tests, Render Blueprint, Vercel SPA configuration, and detailed documentation.

## Verification and scope

The frontend production build and eight unit/adapter tests passed under **Node 24.19.0**. Backend JavaScript syntax/import checks passed. The MongoDB integration tests are included, but could not run to completion in the build environment: its local MongoDB process failed during startup with exit code `100`. Browser visual testing was also unavailable because the browser download failed. See [docs/TESTING.md](docs/TESTING.md) for exact verification and acceptance steps.

This is a production-oriented implementation, **not a claim of a completed production security audit or load test**. Before a real examination, complete the documented end-to-end checks against your Atlas cluster and your chosen execution provider. Live Atlas, Judge0 and AI credentials are not supplied or tested. MCQ assessments do not require an execution or AI provider.

The supported deployment baseline is **one Render API instance** with a MongoDB-backed grading queue. Multi-instance Socket.IO and distributed rate limiting require shared adapters; see architecture documentation. Browser monitoring is best-effort and cannot make a website cheat-proof.

## Technology

| Layer | Stack |
| --- | --- |
| Client | React, Vite, JavaScript, React Router, Axios, Tailwind CSS, Framer Motion, Monaco, Socket.IO client |
| API | Node.js, Express 5, Mongoose, Socket.IO, JWT, bcrypt, Zod, Helmet, CORS, express-rate-limit |
| Database | MongoDB Atlas (transactions require a replica set) |
| Execution | External Judge0-compatible isolated sandbox |
| Optional AI | Server-side OpenAI-compatible chat-completions endpoint |
| Deployment | Vercel client + Render Node web service + Atlas |

## Folder structure

```text
quiz-assessment-portal/
  client/
    public/
    src/
      assets/
      components/{common,layout,assessment,coding,teacher}/
      pages/{Home,Auth,Student,Teacher}/
      hooks/
      context/
      services/
      routes/
      utils/
    .env.example
    package.json
    package-lock.json
    vite.config.js
    vercel.json
  server/
    src/{config,models,controllers,routes,services,middleware,validators,socket,utils}/
    scripts/seed.js
    tests/
    .env.example
    package.json
    package-lock.json
  docs/
  README.md
  render.yaml
```

For every source file's exact path, see [docs/FILE_MANIFEST.md](docs/FILE_MANIFEST.md).

## 1. Requirements

Install VS Code, Node.js (this build was verified on 24.19.0), and a browser with fullscreen support. The package engine requires Node >=22.12.0. Node 25.9.0 meets that range but was not separately tested. This project does not use `better-sqlite3`; bcrypt is version 6.

You need an Atlas database and internet access for npm dependencies. Coding needs a separately provisioned sandbox account/server; AI is optional. Java submissions must use a `public class Main` entry point. Programs read standard input and write standard output.

Verify your terminal:

```powershell
node -v
npm -v
```

Extract the ZIP to a normal writable directory such as `C:\Users\YourName\Documents\quiz-assessment-portal`. In VS Code choose **File → Open Folder** and select the project root. Open **Terminal → New Terminal**.

## 2. Create the MongoDB Atlas database

1. Create an account at https://www.mongodb.com/atlas and create a project and cluster.
2. In database access, create a **database user** with a strong password and read/write access to the application database. This is separate from the website account you use to sign in to Atlas.
3. In network access, add your current public IP for local development. Later add the backend hosting service's outbound addresses. Avoid leaving broad public access enabled for production.
4. In the cluster's **Connect → Drivers** flow, choose Node.js and copy the supplied URI.
5. Replace its username/password placeholders and use database name `quiz_portal`. URL-encode reserved characters in a password embedded in a URI.
6. Keep the connection string in `server/.env`, not in frontend files or Git.

Example format only:

```dotenv
MONGODB_URI=mongodb+srv://YOUR_USER:YOUR_ENCODED_PASSWORD@YOUR_CLUSTER/quiz_portal?retryWrites=true&w=majority
```

Use Atlas or a local MongoDB replica set. A standalone local `mongod` does not support the transactions required by this application.

## 3. Configure and start the backend

From the project root, in VS Code terminal 1:

```powershell
cd server
npm ci
Copy-Item .env.example .env
```

On macOS/Linux replace the copy command with `cp .env.example .env`.

Open `server/.env`. Set `MONGODB_URI`. Generate a JWT signing secret:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Paste the generated value into `JWT_SECRET`. It must be at least 32 characters. Set your initial teacher credentials:

```dotenv
SEED_TEACHER_NAME=Your Name
SEED_TEACHER_EMAIL=teacher@example.com
SEED_TEACHER_PASSWORD=choose-a-unique-long-password
```

The seed password must be at least 12 characters. There is no hardcoded default password and no public teacher registration.

```powershell
npm run seed
npm run dev
```

Expected startup message: `Assessment API listening on 5000`.
Visit `http://localhost:5000/api/health` to check the API.

The seed creates the teacher only if the email is new, adds sample student UID `24BCS12345`, and adds two original bank questions if the teacher has no questions. Re-running it does not change an existing password. Remove the seed password from deployed environment variables after provisioning. Do not put real passwords in the source repository.

## 4. Configure and start the frontend

Open **a second VS Code terminal** at the project root:

```powershell
cd client
npm ci
Copy-Item .env.example .env
npm run dev
```

On macOS/Linux use `cp` as above. Open `http://localhost:5173`. Keep both terminal processes running. Stop either with **Ctrl+C**.

If Vite chooses another port because 5173 is occupied, free the port or update `CLIENT_URL` to the exact origin and restart the server.

## 5. Test your first quiz

1. Choose **Teacher Login** and use the seed email/password.
2. In **Students**, add your own UID/name/course/section or use the sample student. Ensure status is ACTIVE.
3. In **Question Bank**, create questions. Correct option indexes are managed by radio/checkbox controls. For short answers, grading is case-insensitive exact match after trimming.
4. In **Assessments → Create assessment**, fill details and choose questions. Use QUIZ if you do not yet have a code runner.
5. Save. In the assignment section, select individual students or a course/section and click **Save assignment**.
6. Click **Generate / rotate access code**. Copy the displayed code now; only a bcrypt hash is stored. Also copy the assessment ID displayed above.
7. If students should enter the lobby before you start, save status as SCHEDULED. An optional start time is the earliest teacher start time; tests do not start automatically.
8. Share the ID/code with the assigned students through your normal secure channel. Click **Start assessment** when ready.
9. Open an incognito/private browser window for the student, keeping the teacher session separate. Verify the UID, confirm identity, enter the assessment ID/code and enter the lobby.
10. Accept the instructions and press **Start / resume assessment**. Grant fullscreen if configured.
11. Answer questions. Watch Saving/Saved. In the teacher window, inspect **Live Monitor**.
12. Try a configured clipboard or tab-change rule. Warning counts and events should appear on the server and in the monitor. Related focus/visibility/fullscreen events within two seconds count once.
13. Submit. Teacher results show marks. Student marks remain hidden until the teacher clicks **Publish results**.
14. In a separate test assessment, check AUTO_SUBMIT, TERMINATE, expiry, teacher-end and rejected late saves.

Use one student tab per attempt. The UID + shared assessment code flow provides assessment access control, but is not proof of the person's real-world identity; institutional SSO/individual authentication would be needed for that stronger assurance.

## 6. Code runner setup

The API implements the Judge0 CE submissions protocol. Provision a **trusted isolated Judge0-compatible service**, independent of the Render API process. Do not use a public demo endpoint for sensitive assessments.

Set on the server:

```dotenv
CODE_RUNNER_URL=https://your-trusted-runner.example
CODE_RUNNER_API_KEY=your-server-side-key
CODE_RUNNER_AUTH_HEADER=X-Auth-Token
CODE_RUNNER_HOST=
CODE_RUNNER_LANGUAGES={"c":50,"cpp":54,"java":62,"python":71,"javascript":63}
```

For a RapidAPI-hosted compatible provider, use its base URL, `CODE_RUNNER_AUTH_HEADER=X-RapidAPI-Key`, and its required `CODE_RUNNER_HOST`. Verify language IDs with that provider; the defaults are common Judge0 CE IDs, not a universal registry.

The provider must accept `POST /submissions?base64_encoded=true&wait=false` and polling `GET /submissions/{token}?base64_encoded=true`. Limits include configured CPU/memory, wall time, 32 KB output file size, and `enable_network:false`. Your provider must actually enforce those restrictions. Never point this at an unrestricted execution API.

Create a coding question with at least one hidden weighted test. Add visible samples for **Run Code**. Programs must print only the required output, without input prompts. Submit Code creates a durable job; the UI polls status. Final assessment submission queues the latest saved code draft automatically. Hidden execution stdout, stderr and compilation output are never returned to the student, because a program could echo its secret input.

Infrastructure failures stay pending; they are not silently scored as wrong answers. The teacher can retry ERROR jobs in Submissions. See [docs/CODE_EXECUTION.md](docs/CODE_EXECUTION.md).

## 7. Optional AI setup

Leave the AI variables empty to keep AI disabled. For a compatible provider set:

```dotenv
AI_API_URL=https://your-provider.example/v1/chat/completions
AI_API_KEY=your-server-only-key
AI_MODEL=your-provider-model-id
```

Use a full chat-completions endpoint, not just a base URL. The adapter sends a JSON response-format request with a teacher rubric. If your provider does not support that protocol, modify only `aiGrading.service.js` for its documented interface.

Enable AI in the assessment and configure coding quality/efficiency marks in the question before starting. In **Submissions → Open**, request an AI review, inspect it, and approve, adjust or reject its rubric marks. Correctness comes exclusively from hidden tests. Code is sent to your configured AI provider; choose and disclose a suitable data-handling policy before collecting real student work.

## Environment variables

| Variable | Meaning |
| --- | --- |
| `PORT` | API port, 5000 locally; Render supplies its port |
| `NODE_ENV` | development, test or production |
| `MONGODB_URI` | MongoDB database URI, required |
| `JWT_SECRET` | Random signing secret, minimum 32 characters |
| `JWT_EXPIRES_IN` | Token duration, e.g. `8h`; make long enough for allowed assessment duration |
| `CLIENT_URL` | Exactly one allowed frontend origin, no trailing slash |
| `CODE_RUNNER_URL` | Trusted Judge0-compatible base URL; empty disables execution |
| `CODE_RUNNER_API_KEY` | Sandbox credential, server only |
| `CODE_RUNNER_AUTH_HEADER` | Credential header name, default `X-Auth-Token` |
| `CODE_RUNNER_HOST` | Optional `X-RapidAPI-Host` value |
| `CODE_RUNNER_LANGUAGES` | JSON mapping app language names to provider IDs |
| `AI_API_URL`, `AI_API_KEY`, `AI_MODEL` | Optional AI endpoint/credential/model |
| `SEED_TEACHER_NAME`, `SEED_TEACHER_EMAIL`, `SEED_TEACHER_PASSWORD` | Initial teacher provisioning |
| `VITE_API_URL` | Public API URL including `/api` |
| `VITE_SOCKET_URL` | Public backend origin without `/api` |

Never put secrets in `VITE_*`: these values are compiled into public JavaScript.

## Deployment

Detailed walkthrough: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

**Render backend:** push this folder to your repository. Create a Node Web Service with root directory `server`, build command `npm ci --omit=dev`, start command `npm start`, health path `/api/health`, and a tested Node version. Set server environment variables in Render. Use a service that stays running for real timed assessments; a sleeping service cannot process deadlines or queued jobs while asleep. Keep one API instance for this baseline. `render.yaml` is also supplied as an optional Blueprint.

**Vercel frontend:** import the same repository with root directory `client`, framework Vite, build command `npm run build`, output `dist`. Set `VITE_API_URL=https://YOUR-API.onrender.com/api` and `VITE_SOCKET_URL=https://YOUR-API.onrender.com`. Set the backend's `CLIENT_URL` to the exact deployed frontend origin, then redeploy. `client/vercel.json` handles React Router deep links.

**Atlas:** authorize the backend's network access and keep production/test databases separate. No persistent Render disk is required.

## Test commands

From `server`:

```powershell
npm run test:unit
npm run test:integration
npm test
```

Integration tests start an isolated temporary MongoDB replica set through `mongodb-memory-server`; the first run downloads a MongoDB binary. They never target your configured Atlas database. They require a system that permits launching MongoDB. Use Node 24 for reproducing the verified unit/build setup.

From `client`:

```powershell
npm run build
npm run preview
```

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `JWT_SECRET` validation error | Set a real random string with at least 32 characters in server/.env |
| MongoDB connection failure | Check database user, URI escaping, IP access list and cluster availability |
| Transactions need replica set | Use Atlas or a local replica set, not standalone MongoDB |
| Login fails | Run seed with a new email or use the existing teacher password; seed does not reset it |
| Student cannot sign in | Check active status, assignment, exact assessment ID/code and SCHEDULED/LIVE state |
| Cannot start assessment | Add questions, save assignments, generate an access code, and check start/end times |
| Browser CORS error | Match CLIENT_URL to the exact frontend origin and restart backend |
| `vite` not recognized | Run `npm ci` inside client; use `npm run dev` |
| PowerShell blocks npm.ps1 | Use `npm.cmd` instead of `npm`, or use VS Code's Command Prompt terminal |
| bcrypt install problem | Reinstall dependencies with the tested Node version; do not copy node_modules between machines |
| Run Code unavailable | Configure the sandbox URL/key and validate its language IDs/limits |
| Compilation error in Java | Use `public class Main`; inspect visible-case console output |
| Hidden submission is ERROR | Fix provider configuration, then teacher retries the job; no automatic zero is assigned |
| Score is PENDING | Wait for jobs; inspect Submissions for infrastructure failures |
| AI review unavailable | Enable AI in assessment and configure all three AI variables |
| Saved answers missing after disconnect | Reconnect in the same page; pending changes retry while the page remains open. Hard reload can lose unsaved edits |
| Fullscreen rejected | Start from a direct user click using a supported desktop browser; some mobile browsers restrict fullscreen |
| Another tab receives a warning | Focus/visibility rules apply during active attempts; legitimate transitions can generate signals |
| Vercel refresh gives 404 | Deploy with client as root so vercel.json is applied |
| Port already in use | Stop the previous terminal server or update PORT and matching frontend URLs |

## Security boundary

The application enforces authorization, ownership, attempt state, deadlines and grading on the server. It cannot block OS application switching, reliably detect arbitrary extensions, globally disable the clipboard, prevent screenshots, or guarantee that browser telemetry is genuine. Fullscreen and clipboard prevention are confined to browser APIs. No clipboard contents are collected.

Read [docs/SECURITY.md](docs/SECURITY.md), [docs/PROCTORING.md](docs/PROCTORING.md), and [docs/TESTING.md](docs/TESTING.md) before real use.
