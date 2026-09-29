# Architecture

## Runtime

Vercel serves the React/Vite SPA. It calls the Render Express API through an explicit CORS origin and JWT bearer authorization. Socket.IO runs on the same HTTP server. MongoDB Atlas holds all assessment state, jobs and results. Judge0 and optional AI are external server-side services.

The code follows the requested client/server/docs separation. Routes enforce roles and validation; controllers handle HTTP; services implement assessment transactions, grading, proctor rules and adapters. Models define persistence. Frontend pages compose reusable UI, hooks and service modules. `App.jsx` only composes providers and routing.

## State and transactions

Assessments move from DRAFT or SCHEDULED to LIVE by teacher action, then ENDED. Questions are snapshots of bank records; later bank edits do not change an assessment. Assessment content and assignments are locked once LIVE. StartTime is an earliest manual launch time, not an automatic scheduler. EndTime is an absolute hard deadline. Total marks are calculated from selected snapshots and enabled rubric weights, not submitted by students.

Assigned students without an Attempt are displayed as NOT_STARTED. An attempt is ACTIVE until SUBMITTED, TERMINATED or EXPIRED. A unique assessment/student index prevents retakes and duplicate attempts. Attempt expiry is `min(startedAt + duration, assessment.endTime)`. Assessment closure submits saved work. Expiry preserves EXPIRED as the reason while grading saved answers.

Each active mutation validates student activity, assignment, token scope, ownership, live assessment, attempt status and current server time. It writes a shared assessment revision inside a MongoDB transaction. Manual ending uses that same document, so concurrent end/save transactions conflict and retry rather than accepting a late modification. Warnings and their event record are committed with the attempt update. Network requests that arrive after a deadline are rejected even if the maintenance worker has not run yet.

## Grading jobs

CodeSubmission is the durable queue. A single in-process worker claims QUEUED jobs or expired leases, calls the remote runner, stores ExecutionResult and updates results. Infrastructure failures retry up to three times and then remain ERROR for teacher retry. The deadline maintenance timer runs independently from code execution. Recovery scans create missing result records for recent closed attempts. External calls are outside database transactions; no untrusted student process is spawned by the API.

Latest submitted code per question is graded. Final submission queues a saved draft if different from the last code submission. Quiz scoring is immediate; results remain PENDING until applicable execution jobs finish. Approved AI rubric marks are added separately and cannot alter test correctness.

## Delivery and recovery

Socket events notify but never replace database persistence. Clients periodically refetch authoritative state. Answer autosave is serialized per browser page, debounced, and retried while the page is alive. Student browser storage contains session credentials/user display information only, not authoritative marks/warnings. Reload restores saved database answers. Unsaved memory edits may be lost if the tab closes; no false offline-save guarantee is made.

## Deployment baseline and limits

Run one Render instance. The provided Socket.IO room adapter and HTTP rate limits are in-process. Before horizontal scaling add a shared Socket.IO adapter, distributed limiter and stronger worker lease ownership/fencing. The current worker executes one submission at a time, up to 30 tests each; size capacity for assessment load. Small lists are bounded (5,000 students, 2,000 bank questions, 1,000 code submissions); add cursor pagination for larger installations. Assessment revision locking deliberately favors correctness over high concurrency. Load-test realistic class sizes before deployment.

For a hardened institutional system, add SSO/per-student login, audit retention/exports, teacher account administration/password recovery, operational alerting and a dedicated scalable job worker. These operational extensions are not falsely represented as implemented.
