# Optional AI grading

AI is disabled unless the teacher enables it in a pre-live assessment and the server has AI_API_URL, AI_API_KEY and AI_MODEL. The adapter targets an OpenAI-compatible `/chat/completions` endpoint and requests a JSON object. It sends a trusted system rubric and an explicitly untrusted JSON payload containing only problem description, language and source code. Hidden test cases and expected outputs are not sent.

Required output: `codeQuality`, `efficiency`, `readability` numbers between 0 and 10, plus a feedback string limited to 10,000 characters. Invalid JSON or schema violations fail the review. The teacher manually requests a review in Submissions, sees the suggestion, and approves/overrides or rejects its bounded rubric marks. AIReview persists separately from ExecutionResult.

Question marks are deterministic correctness marks. Optional `qualityMarks` and `efficiencyMarks` are additional maxima when the assessment enables AI. Initial proposals are qualityMarks × codeQuality/10 and efficiencyMarks × efficiency/10. Readability is feedback only. Only APPROVED rubric marks are added. Teacher overrides are validated against configured maxima and cannot change deterministic test scores. Rejected/pending/no reviews contribute zero rubric marks.

The newest code submission per question is authoritative. Reviewing an older submission does not replace the newest submission's rubric. Do not request AI on code before deterministic execution completes. A review may be requested for each new submission; repeated create requests for the same submission are rejected.

AI output can be wrong or manipulated by source comments. Structured JSON and human review reduce risk but do not guarantee quality. Provider uptime/cost/data retention depend on the service you configure. Code is educational personal data; select a provider and retention policy consistent with institutional requirements.
