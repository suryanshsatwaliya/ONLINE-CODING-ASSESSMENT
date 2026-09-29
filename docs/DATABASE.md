# Database

MongoDB Atlas or a replica set is required; transactions do not work on standalone MongoDB. Mongoose builds the declared indexes on startup by default.

| Collection/model | Purpose and key constraints |
| --- | --- |
| Teacher | Name, normalized unique email, select-excluded bcrypt passwordHash, role |
| Student | Globally unique uppercase UID, identity, course, section, optional email, active status, owner |
| Course | Course/section catalog model; current UI stores course and section strings on students |
| Question | Teacher-owned reusable question including private correct answers and coding tests |
| Assessment | Teacher-owned question snapshots, lifecycle, times, security, hashed access code and grading/publication settings |
| AssessmentStudent | Assignment; unique (assessment, student) |
| Attempt | Unique (assessment, student), server start/expiry, state, warnings, saved answers, randomized ordering |
| Answer | Answer mirror indexed uniquely by (attempt, questionId); saved transactionally with attempt |
| CodeSubmission | Source, language, question, attempt, job status, lease, retries, deterministic score |
| ExecutionResult | Unique submission result; full test output is teacher-only |
| ProctorEvent | Unique (attemptId, eventId), server timestamp, rule and authoritative warning count |
| Result | Unique attempt; separated quiz/coding/AI scores, total, percentage and pending/graded status |
| AIReview | Unique code submission review; provider JSON, proposed/approved rubric marks, teacher decision |

Questions use their bank ObjectId as the snapshot question key. Assessment question array order is the teacher order; attempt.questionOrder and optionOrders persist randomization. Answer values are arrays of original option indexes, strings for short answer, or `{code, language}` for code.

Correct answers and hidden tests are removed by the explicit student projection. Do not create endpoints returning raw populated Question records to students. accessCodeHash and passwordHash are select-excluded and only loaded for authentication.

A teacher owns their students, questions, assessments and related results. Students with attempt history cannot be deleted through the UI; deactivate them to preserve history. There is no automatic event/code retention deletion. Set a documented retention process and Atlas backup policy appropriate to your institution.
