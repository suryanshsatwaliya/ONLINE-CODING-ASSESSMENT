# Vercel + Render + MongoDB Atlas

## Prepare

Extract the application, run locally and test with your own test database and code runner. Create a Git repository from the project root and push it to your Git host. `.gitignore` excludes real `.env` files, node_modules and dist. Inspect changes before committing; never commit a real URI, access token or seed password.

## Atlas

Create a cluster and a database user with read/write access to `quiz_portal`. Configure network access for your local IP and, later, the hosting service's outbound addresses. Copy the Node driver URI from Connect, insert the database username, URL-encoded password and database name. Put it into Render's MONGODB_URI. Atlas login credentials and database credentials are distinct. Use a separate database for acceptance testing. Configure backups/retention before real assessments.

Official guide: https://www.mongodb.com/docs/atlas/connect-to-database-deployment/

## Render API

Create a **Web Service**, connect the repository and choose:

| Setting | Value |
| --- | --- |
| Root directory | server |
| Runtime | Node |
| Build command | npm ci --omit=dev |
| Start command | npm start |
| Health check | /api/health |
| Node version | A tested Node 24 runtime (generation checks used 24.19.0) |
| Instance count | 1 for the supplied room/limiter/worker baseline |

Set NODE_ENV=production, MONGODB_URI, JWT_SECRET, JWT_EXPIRES_IN=8h and CLIENT_URL. Set code runner and optional AI credentials. Render supplies PORT; the code reads it. No disk persistence is needed. Choose an always-running deployment for timed tests and background grading.

Provision the teacher by temporarily setting seed variables and running `npm run seed` in a Render shell, or run the seed locally with the intended production database URI after reviewing that choice. Remove the seed password afterward. Seed does not overwrite existing teacher passwords.

Use the generated `https://<service>.onrender.com` URL for the client. Confirm `/api/health` works. WebSockets are served on the same origin/port as Express. Do not run the backend as a Vercel serverless function; this deployment uses a persistent Render process for Socket.IO and the worker.

Official guides: https://render.com/docs/deploy-node-express-app and https://render.com/docs/websocket . `render.yaml` is an optional Blueprint with environment values left for you to supply.

## Vercel client

Import the repository, choose root `client`, framework preset Vite, install command `npm ci`, build command `npm run build`, output `dist`.

Set:

```dotenv
VITE_API_URL=https://YOUR-API.onrender.com/api
VITE_SOCKET_URL=https://YOUR-API.onrender.com
```

Deploy, then set Render CLIENT_URL to your exact Vercel origin (e.g. `https://YOUR-PROJECT.vercel.app`) with no trailing slash. Redeploy Render. Changes to VITE variables require a new client build. The included vercel.json rewrites application deep links to index.html while leaving `/assets/` intact.

Do not put database, JWT, sandbox or AI secrets in Vercel frontend variables. Do not allow every preview origin by default; add a separate test backend/origin if needed.

Official guides: https://vercel.com/docs/frameworks/frontend/vite and https://vite.dev/guide/static-deploy

## Acceptance after deployment

Check teacher login, assigned student login, CORS, Socket.IO reconnection, deep-link refresh, editor worker loading, visible/hidden execution, published result visibility and deadlines across a backend restart. Check wrong-role and cross-student access with API requests. Verify the provider's network/CPU/memory restrictions independently.

## Scaling

Do not increase instance count without a shared Socket.IO adapter, distributed rate limiting and a fenced job queue. The assessment revision lock is intentional and can limit throughput. Load-test your class size. Add observability and queue alerts. A sleeping or restarting service does not process a timer while stopped, although every later mutation still checks the persisted deadline.
