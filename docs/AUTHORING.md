# Assessment authoring

In **Question Bank → Create Question**, choose **Quiz (MCQ)** or **Coding**. Enter the set title and optional description, then add, edit, duplicate, reorder or delete questions. Save the complete set to the bank. Creation and editing stay inside Question Bank; duration, scheduling, students and security are configured only in Assessments. Point inputs start blank; a positive point value is required for each question. Optional scoring fields appear blank when zero.

Each set is stored atomically as one database document. Editing uses revision checks to prevent stale saves from overwriting newer changes. Existing individual bank questions and assessments remain available without a destructive migration.

In **Assessments → Create Assessment**, enter the title and choose Quiz, Coding or Mixed. Select compatible saved sets, configure duration and security, and save. Assign students and generate their access code in the saved assessment, then start it when ready. Earlier individual bank questions can still be selected. No question authoring occurs in Assessments.

Selected questions are copied into the assessment. Reusing a set does not change the original. Bank edits and deletion do not change existing assessment snapshots. Editing assessment settings preserves retained snapshots. To deliberately refresh a set, remove it from a draft assessment, save, then select it again. Selected sets can be reordered; legacy individual questions precede them.

Each set and each assessment supports up to 100 questions. Set saves have a 5 MB request limit. A failed save leaves the form intact. Unsaved edits are held in the page; save before leaving. Refreshing a dirty editor prompts before discarding changes.

## LeetCode import

Enter `67`, `LeetCode 67`, or `LeetCode #67` in a coding question's import box. The server resolves the public problem number against LeetCode's problem catalog, then fetches its public details. No user credentials are sent. Premium problems are rejected; provider errors leave the current question unchanged.

Import fills the title, statement, constraints, difficulty, tags, source URL, and public examples including explanations. Marks are preserved. Importing again replaces the question's content, sample cases and starter code, as indicated on the button.

LeetCode's private judge test suite is not available. Imported cases are always **visible**. Sets may be saved without hidden tests, but every coding problem needs at least one original hidden test before the set can be selected for an assessment. Incomplete sets are clearly marked in the bank and assessment picker.

This portal executes programs using standard input/output rather than LeetCode's function-call harness. Imported examples use one JSON argument per input line, and a compact JSON result on output. Strings retain their quotes. Python and JavaScript receive runnable I/O scaffolds with an unimplemented `solve` function; they do not contain solutions. Other languages can be enabled and given appropriate full-program starter code manually.

Review imports before using them: special data structures, design problems, multiple valid answers, custom checkers, and non-JSON examples may require manual adaptation. This runner uses exact normalized output matching, not LeetCode's custom checker. Examples that cannot be converted reliably retain their original text and explanations, with a review notice, but do not become runnable tests. Expected outputs are never invented. The editor supports 20 examples and 30 test cases per problem; any truncation is reported.

## API

`POST /api/questions/import/leetcode` accepts `{ "reference": "LeetCode 67" }` and returns `{ question, warnings }`. It requires teacher authentication and allows 30 requests per 15 minutes per IP. It does not save a question.

`GET/POST /api/question-sets` list or create teacher-owned sets. `GET/PUT/DELETE /api/question-sets/:id` read, update or delete owned sets. Updates require the current `revision`. A set contains `title`, `description`, `type` (QUIZ/CODING), and a validated `questions` array.

`POST /api/assessments` and `PUT /api/assessments/:id` select `questionSetIds`, with optional legacy `questionIds`. They reject inline `newQuestions`. The server enforces ownership, compatible types, grading readiness, and a combined 100-question limit. Saved assessments contain question snapshots, set metadata, and computed total marks.

Student access uses one six-character uppercase alphanumeric code and the student's UID. Use the **Student access** panel to generate, replace or copy the code; students do not enter an assessment ID. Existing assessments need one fresh code after upgrading from the old ID/code flow.

Teachers can delete their own Draft and Scheduled assessments from the assessment cards or the saved assessment controls. A confirmation names the assessment before deletion. Deleting removes the assessment and its student assignments together; saved questions and sets stay in the Question Bank. Live and Completed assessments, and any assessment with student attempts, cannot be deleted. The API enforces these rules even if the page has an outdated status.

## Automatic assessment ending

After student login, the app opens the assessment lobby directly. The old `/student` URL redirects to that lobby; there is no intermediate assessment dashboard.

Starting an assessment records `startedAt` and a shared `closesAt` deadline: teacher start plus duration, capped by an earlier hard closing time. Late joiners receive only the remaining time. When every assigned student has a finished attempt (submitted, expired or terminated), the assessment ends automatically. Assigned students who have not joined keep it open until the deadline. At the deadline the server marks it ENDED, expires active attempts, submits saved answers/code and queues grading. The worker checks approximately every three seconds; requests reject late starts and changes immediately at the deadline. Teacher views use events with a five-second refresh fallback. Existing running assessments without a start timestamp use the earliest recorded attempt start, or their last update when no attempt exists.


### Scheduled start and student countdown

When a start time is set, the create and edit forms calculate Hard Close Time as start plus duration; changing either recalculates the close time. The API also derives that value. Save as SCHEDULED, assign students, and generate an access code before the scheduled time. The lifecycle worker starts ready schedules automatically; student lobby/start requests also synchronize a due schedule immediately. DRAFT assessments and schedules without a start time still require a manual start. Missing questions, assignments, or an access code prevent automatic opening. A missed window ends instead of granting extra time after a restart.

The student lobby shows a server-synchronized countdown. Students acknowledge the rules and enter required fullscreen before the start; ready students enter automatically once LIVE. Browsers require a user gesture for fullscreen, so a student who exits it must click to restore it. The exam header then counts down to the shared deadline; late joiners receive only the remaining time.
