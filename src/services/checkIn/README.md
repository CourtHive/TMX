# Match check-in

Check-in records individual presence for one match. Tournament sign-in records arrival and is a separate action.

The Scheduling workspace's **Check-In** mode (`/scheduling/:date/check-in`) is available independently of draw type. It includes matches assigned to that date, even without a court or time, and always shows individual counts including zero. Matches without participants and byes are excluded; completed matches require the explicit filter. Undated matches need a schedule date before appearing at this desk.

The shared editor (`components/checkIn/checkInEditor`) resolves hydrated state by draw/match identifiers. It uses the existing mutation pipeline, displays acknowledged results, disables writes while pending, and reads attribution history only while open. Factory actions determine whether check-in is offered; the factory's play/score restriction also disables check-out. Errors leave stored state authoritative. No bulk check-in or automatic presence is inferred from arrival, scheduling, or calling a match.

General schedule surfaces retain the existing passive badge policy: catalog and NOW-strip badges are absent at zero and display partial/complete counts once someone has checked in for that match. Prompt mode controls interruptions, not passive badge visibility. Its default is off; auto asks only when check-in is in use on the viewed date; on asks whenever individuals are missing. Autocall continues without interactive prompts.

Check-ins save immediately and never join scheduling Save/Discard drafts. Date/mode navigation retains the workspace's existing unsaved-schedule guard. Mounted desk/editor observers refresh after acknowledged local writes, applied remote writes and record reloads, and unsubscribe on teardown.

Both manual call paths use `confirmCheckInCall`: cancellation applies no methods; confirmation continues once. Changed tournament, route, schedule, status or line-up invalidates an open confirmation. A NOW drop also verifies its destination before applying placement and call methods together. Private attester details are not added to cards or warning dialogs.

Verification lives in journey 105 (menu and persistence), journey 205 (round robin desk, keyboard operation, badge policy, call decisions and applied-update refresh), and the check-in model/prompt/badge unit tests. These client browser tests do not replace a live server/two-client transport test.
