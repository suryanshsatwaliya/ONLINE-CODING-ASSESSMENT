# Master administration and account recovery

The Master Admin interface is a separate React route backed by the Express API. It uses MongoDB records already present in the portal and does not participate in teacher/student JWT authorization.

## First administrator provisioning

Set these server environment variables before starting the API:

| Variable | Purpose |
| --- | --- |
| `MASTER_ADMIN_EMAIL` | Email for the only provisioned Master Admin account |
| `MASTER_ADMIN_PASSWORD` | Initial password (12–72 characters with uppercase, lowercase, number, and special character) |
| `ADMIN_TOTP_ENCRYPTION_KEY` | 32 random bytes encoded as 64 hexadecimal characters; AES-256-GCM key for authenticator secrets |
| `MASTER_ADMIN_PATH` | Single URL slug for the entry page, default `control-room` |
| `ADMIN_SESSION_HOURS` | Admin session lifetime, from 1 to 24 hours |

Set `VITE_MASTER_ADMIN_PATH` to the same slug in the client build environment and rebuild/redeploy the SPA. Open `https://your-site.example/<slug>` (the slug can also be appended to an existing SPA URL). After password and authenticator verification, the browser moves to `/admin/overview`, removing the entry slug from the address bar. The path is only a discovery route; the API still requires the admin password and mandatory TOTP.

Generate secrets locally with Node:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

On first server startup, a Master Admin record is created if that email does not already exist. Later environment password changes do not overwrite an existing account password. Use the account's recovery codes or provision a deliberate credential reset if the original password is lost. Keep the encryption key stable: rotating it without decrypting and re-encrypting stored TOTP secrets will prevent authenticator verification.

## Microsoft Authenticator

The first successful password login opens enrollment. Scan the QR code in Microsoft Authenticator, enter the first six-digit code, then save the one-time recovery codes. TOTP uses SHA-1, six digits, a 30-second period, and accepts a one-step clock drift. Every later login requires a new TOTP code; a recovery code is single-use. The stored authenticator secret is encrypted with AES-256-GCM and is never returned after enrollment. Recovery codes are stored as SHA-256 hashes.

Admin sessions are opaque random values in `HttpOnly` cookies, persisted by token hash, limited by `ADMIN_SESSION_HOURS`, and protected by a double-submit CSRF token and allowed-origin check on state-changing requests. Production cross-origin deployment uses `Secure; SameSite=None`; local development uses `SameSite=Lax`. Deploy the API and SPA with credentialed CORS and the exact SPA origin in `CLIENT_URL`.

## Teacher accounts and password reset

Create teachers from the Master Admin **Teachers** page. Each receives a generated temporary password, stored only as a bcrypt hash and delivered through email. The interface never displays the password. If credential email delivery fails, use the account's Reset action to generate and send a fresh temporary password. Teacher email and username are both accepted at sign-in.

Configure Resend with `RESEND_API_KEY` and a verified `EMAIL_FROM` sender. Set `PUBLIC_APP_URL` to the public client origin for password-reset links. Email delivery is disabled with a visible application response outside production when variables are absent, and the API responds generically to password-reset requests to avoid account enumeration.

Teacher reset links contain cryptographically random 256-bit tokens. Only SHA-256 token hashes are stored; links expire after 15 minutes and are single-use. A successful reset requires matching passwords of at least 12 characters containing uppercase, lowercase, a number, and a special character. It increments the teacher token version and removes persisted teacher sessions. The teacher receives a confirmation email when configured.

## Admin pages and API

The client sidebar includes Overview, Teachers, Students, Sections, Assessments, Analytics, Activity Logs, Security Settings, Admin Settings, and Logout. All data pages call the protected Express API. All `/api/master-admin` management endpoints require an active Master Admin session; enrollment/verification endpoints require a limited pre-authentication session.

| API | Description |
| --- | --- |
| `POST /api/master-admin/auth/login` | Password stage, then pre-auth session |
| `GET /api/master-admin/auth/setup` | Authenticator enrollment QR and setup key, only before activation |
| `POST /api/master-admin/auth/verify` | TOTP or one-time recovery-code verification |
| `GET /api/master-admin/overview` | Record totals and active persisted sessions |
| `/api/master-admin/teachers` | Teacher directory, create, edit, deactivate, delete, reset |
| `/api/master-admin/students` | Searchable roster and teacher reassignment |
| `/api/master-admin/sections` | Section roll-up and bulk teacher reassignment |
| `/api/master-admin/assessments` | Assessment participation, end live assessment, delete only without history |
| `GET /api/master-admin/analytics` | Login, completion, teacher, student, and section analytics |
| `GET /api/master-admin/logs` | Searchable audit history |
| `/api/master-admin/security` | TOTP status, recovery-code rotation, and other-session revocation |

Existing teacher/student APIs keep their bearer-token authorization. New teacher/student sign-ins receive persisted sessions that expire with their JWTs; logout revokes the current session. Teacher reassignment updates the current student owner while assessment assignments and attempts retain their IDs and history.

## Analytics and audit limits

Counts are queried from MongoDB. Login charts and unique authenticated-user counts are measured from successful teacher/student sign-ins. Anonymous browser visits are not collected, so they are not presented as visitor counts. Peak daily traffic is reported as the busiest day by recorded successful logins, not request throughput. A session is counted while its persisted expiry is in the future; MongoDB's TTL cleanup is not relied on for authorization.

Audit records include event type, actor, target, timestamp, IP where available, and safe metadata. Passwords, TOTP secrets, reset tokens, and recovery codes are never written to activity logs. Records are retained until an operator defines a retention policy and Atlas backup/retention configuration.
