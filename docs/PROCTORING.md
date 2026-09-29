# Browser monitoring and authoritative warnings

`useFullscreen.js` requests fullscreen from a user click. `useProctoring.js` listens only while an attempt is active. Enabled clipboard rules prevent default copy/paste/cut actions in the assessment document, including Monaco's textarea event path. Normal typing/selection/navigation remain untouched. Context menus use the configured policy. Browser/editor capabilities can vary; test your required browser.

Events: FULLSCREEN_EXIT, TAB_HIDDEN, WINDOW_BLUR, WINDOW_FOCUS, COPY_ATTEMPT, PASTE_ATTEMPT, CUT_ATTEMPT, CONTEXT_MENU_ATTEMPT, PAGE_EXIT_ATTEMPT, DISCONNECTED, RECONNECTED. Lifecycle events are written by the server. No event carries clipboard data or client-supplied warning counts.

Rules are IGNORE, LOG or WARNING. A disabled corresponding security toggle prevents warning generation. An IGNORE event may still be retained with rule metadata for auditing but does not warn. Window focus and network transitions default to informational logging. Server Socket.IO connection changes are logged independently of the student's event listener.

The client creates a UUID per event and retains a bounded in-memory retry queue. The backend's unique (attemptId,eventId) index and transaction prevent duplicate application. Fullscreen, visibility, blur and page-exit signals share a LEAVE warning group with a two-second suppression window. Consecutive same-type clipboard signals also debounce for two seconds. The server timestamp, not browser time, controls suppression.

In one transaction, the server validates an active attempt, records the event, increments warnings if applicable and closes the attempt when its configured threshold is reached. AUTO_SUBMIT submits already-saved answers and code drafts; TERMINATE locks the attempt without queuing new drafts. Both reject further answer/code mutations. A hard reload does not clear warning counts.

Clipboard warning text and counts are displayed in a modal. Returning to fullscreen requires another user action. Clipboard blocking is restricted to the page; no global OS restriction is claimed.

Page-exit delivery is best-effort because browsers can cancel requests during shutdown. beforeunload prompts are browser-controlled and do not prove delivery. Socket disconnect logs provide another signal. Events cannot be guaranteed if an extension suppresses them, JavaScript is disabled, the browser crashes, or the network is unavailable. Pending client events are memory-only; no false guarantee of hard-close recovery is made.

Autosave queues serialize one-question PATCH requests and retry after connectivity returns while the page is alive. A displayed Saved state means the server acknowledged those writes. Final manual submit flushes pending saves. Expiry/teacher-end/warning-limit uses what the server has already persisted, so unsent work may not be included.
