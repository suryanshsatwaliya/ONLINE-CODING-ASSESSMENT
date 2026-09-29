# Isolated code execution

`server/src/services/codeRunner.service.js` is the only student-source execution adapter. It speaks the Judge0 CE submission/polling protocol. Set a trusted provider URL and credentials. Configure its language IDs rather than assuming every provider matches the default C=50, C++=54, Java=62, Python=71, JavaScript=63 map.

Run Code selects visible tests only and returns status, bounded stdout/stderr/compile output, time and memory when available. Submit Code creates a MongoDB job for hidden tests only and returns immediately. Hidden responses expose only status, passed count, total count and deterministic score. Never return provider stdout, stderr, compilation errors, tokens or hidden inputs through this endpoint.

For each case the adapter sends base64 source/stdin, CPU time <=5 seconds, wall limit <=15 seconds, memory <=256000 KB, max_file_size=32 KB and enable_network=false. The provider must enforce these settings and process/filesystem isolation. The HTTP adapter has request and polling deadlines. A submission has at most 30 cases. It runs no compiler or child process locally.

Correctness uses successful execution plus normalized string comparison: CRLF becomes LF and trailing whitespace is removed; leading/internal whitespace stays significant. Hidden tests receive positive weights. Formula: `marks * passedWeight / totalHiddenWeight`, rounded to two decimals. AI never enters this formula. Run Code's sample score is informational and is not persisted as correctness marks.

The queue claims jobs with a lease, retries provider failures three times and allows teacher retry from ERROR. ERROR remains a pending result instead of an invented zero. The supported deployment is a single worker/API instance. Restart recovery reclaims stale leases. Multi-worker scaling needs ownership/fencing and a dedicated queue architecture before enabling replicas. A code-run count is reserved before contacting the provider, so even a failed provider call consumes a configured attempt allowance.

Compilation/runtime/wrong-answer statuses are legitimate execution outcomes; a provider transport error is an infrastructure failure. Hidden compilation details are intentionally suppressed because compilers/macros or malicious source can encode input in errors. Teachers can inspect full stored ExecutionResult records.

Test the provider with a passing program, compile error, wrong answer, runtime error, infinite loop, output flood, memory exhaustion and attempted network access before a real assessment. The included adapter tests mock protocol responses; no live provider credentials were available during generation.

Primary protocol reference: https://ce.judge0.com/ . The application does not depend on or automatically contact that demo host.
