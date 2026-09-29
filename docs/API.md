# REST API

Base: `http://localhost:5000/api`. JSON requests. Protected endpoints require `Authorization: Bearer <JWT>`. Teacher and student routes are separated by backend role checks, not browser navigation. Valid object IDs are required.

Error envelope: `{"success":false,"message":"...","errors":[]}`. Validation: 422; invalid ID/body: 400; unauthenticated: 401; forbidden: 403; missing record: 404; state conflict: 409; rate limit: 429; infrastructure: 502/503/504; unexpected: 500.

| Method | Path | Role / behavior |
| --- | --- | --- |
| GET | /health | Public readiness timestamp |
| POST | /auth/teacher/login | `{email,password}` → token and teacher |
| POST | /auth/student/verify | `{uid}` → active student's name/course/section |
| POST | /auth/student/login | `{uid,assessmentId,accessCode}` → assessment-scoped token |
| GET | /auth/me | Authenticated token identity |
| GET, POST | /students | Teacher list/create |
| PUT, DELETE | /students/:id | Owner update/delete without history |
| GET, POST | /questions | Teacher bank list/create |
| PUT, DELETE | /questions/:id | Owner update/delete |
| GET | /questions/reference?reference=LeetCode%2045 | Records reference metadata; no scraping |
| GET, POST | /assessments | Scoped list / teacher create |
| GET, PUT | /assessments/:id | Scoped details / teacher edit before LIVE |
| POST | /assessments/:id/assign | `{studentIds,course?,section?}`; replaces assignment with union of selections and matching filters |
| GET | /assessments/:id/assignments | Teacher assignment list |
| POST | /assessments/:id/access-code | Teacher creates/rotates a secret; plaintext returned once |
| POST | /assessments/:id/start | Teacher starts valid prepared assessment |
| POST | /assessments/:id/end | Teacher ends and submits saved active attempts |
| PATCH | /assessments/:id/publish | `{publishResults:boolean}` |
| GET | /assessments/:id/monitor | Teacher roster including NOT_STARTED students |
| GET | /assessments/attempt/:id/events | Teacher chronological event log |
| POST | /attempts/start | Student starts/resumes token-scoped assessment |
| GET | /attempts/:id | Own attempt + sanitized questions + serverTime |
| PATCH | /attempts/:id/answers | `{questionId,value,marked}` for one question |
| POST | /attempts/:id/submit | Submit saved work; client flushes autosave first |
| GET | /code/languages | Backend configured language keys |
| POST | /code/run | `{attemptId,questionId,language,code}`; visible tests only |
| POST | /code/submit | Same input; queues hidden grading, returns 202 and submissionId |
| GET | /code/:id | Own job status and hidden pass-count/score only |
| POST | /proctor/events | `{attemptId,eventId:UUID,eventType}`; no clipboard contents |
| GET | /results/:id | Teacher-owned assessment results |
| GET | /results/mine/:id | Student attempt status and result only if published |
| GET | /results/attempt/:id | Teacher answer/code/execution details |
| GET | /results/submissions | Teacher code submissions |
| POST | /results/retry/:id | Teacher retries ERROR execution job |
| POST, GET | /ai/:id | Teacher creates/reads AI review for code submission ID |
| PATCH | /ai/:id | Teacher review ID: `{qualityScore,efficiencyScore,status}` |

Student login authorizes exactly one assessment. SCHEDULED or LIVE is required. Deactivated students or revoked assignments are rejected on subsequent protected requests. Role tokens cannot be used interchangeably.

Assessment create/update uses questionIds, not browser-supplied marks/scores. See `server/src/validators` for complete schemas. Most successful mutation responses are the updated object; delete returns `{success:true}`.

Socket authentication uses `{auth:{token}}`. Server-controlled rooms: teacher:<id>, student:<id>, assessment:<id>. Clients cannot request arbitrary room joins. Events: ASSESSMENT_STARTED, ASSESSMENT_ENDED, ATTEMPT_UPDATE and MONITOR_UPDATE. Attempt updates carry terminal status/warnings; full monitoring details are fetched through teacher REST authorization.
