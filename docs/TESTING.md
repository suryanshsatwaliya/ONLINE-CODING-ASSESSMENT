# Verification record and acceptance plan

## Verification performed

- Vite production build: passed after the Master Admin implementation.
- Backend JavaScript syntax checks: passed for all 83 files under `server/src`.
- Focused admin security, admin integration, and assessment integration suites: 19/19 passed using the isolated MongoDB replica set.
- Full backend suite: 33/37 passed. Four existing assertions are out of sync with current behavior: AI adapter fixture omits fields required by the strict review schema; authoring tests expect bare LeetCode slugs although imports require problem numbers or URLs; an authoring test expects `null` where the service returns an empty string; and the hidden-runner test expects an older result object shape. These failures were not changed as part of the Master Admin work.
- `git diff --check`: passed (Git reported only expected LF-to-CRLF working-copy notices).
- Live Atlas, sandbox, AI and production deployment were not exercised; no service credentials were provided. Browser visual QA was not run.

The system Node shim in this environment points to an inactive Node version, so checks were run with the installed Node v24.22.2 executable directly.

Tests use Node's built-in runner. `npm run test:unit` needs no database. `npm run test:integration` downloads/starts an isolated MongoDB replica set and never uses your Atlas URI. `npm test` runs both. If MongoDB cannot start in your environment, run on a normal development machine with supported MongoDB binary dependencies. Do not weaken OS/container permissions on a production server solely to run the test harness.

## Before an actual class

1. Seed a test teacher, add two assigned students and one unassigned student, and create a mixed assessment with samples and hidden cases.
2. Confirm unrelated teachers cannot read/edit its students/questions/assessments/results. Student tokens must fail teacher endpoints and another student's attempt/job/result.
3. Start once concurrently from two student windows. Only one attempt should exist.
4. Answer, reload and verify persisted answers, option ordering, expiry time and warning count.
5. Disconnect briefly, edit while disconnected, reconnect without closing the tab and verify acknowledged autosaves. Confirm late saves after expiry are rejected.
6. Trigger copy/paste/cut with settings on/off inside both normal questions and Monaco. Check normal typing and navigation.
7. Trigger visibility and blur together and verify one grouped warning. Retry the same event UUID and verify one stored event/increment.
8. Check both warning limit policies. A closed attempt must reject answers, runs, code submissions and repeated final mutation attempts.
9. End from the teacher while a save is in flight. Verify post-end writes cannot commit.
10. Restart the API with active attempts and queued jobs. Verify saved deadlines and grading recovery.
11. Test correct/incorrect code, compilation errors, time/memory/output limits and denied network access on the real sandbox.
12. Inspect student network responses: no correct answers, hidden input/output, execution credentials, or AI internals.
13. Confirm final code drafts are queued, infrastructure failures remain pending, retry works and approved AI marks do not change correctness.
14. Publish and unpublish results. Confirm private results are not retrievable with a student JWT.
15. Exercise desktop/mobile layouts, keyboard navigation, focus behavior, screen reader labels and fullscreen limitations in supported browsers.

The ZIP is an implementation for local setup and further deployment validation, not evidence of passing a live production penetration test.
