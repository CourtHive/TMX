# Rotating-partner settlements

## Operator flow

An Americano/Mexicano match belonging to an applied round offers **Settle standings** in
its actions menu after an irregular terminal result. Pending/live matches and ordinary
completed matches do not offer it. Provider-owned tournaments require a director/admin
of that provider; normal mutation authorization remains authoritative.

Choose **Exclude from standings**, **Count recorded points**, or **Award points**. Credits
require an existing winning side; played points require a recorded score. Enter a reason
and preview the four players' points and resulting standings totals. Editing an input
invalidates approval. Confirm submits one `settleRotatingPartnerResult` through
`mutationRequest`; it does not alter the sporting score or winning side.

The preview uses a factory dry run, including its historical round contracts, rather than
a second tally implementation. It leaves state unchanged. A stale/refused result keeps
the dialog open and requires a fresh preview. Replacing a prior settlement explicitly
names its latest requestId. Separate deciding phases and round regeneration are not
implemented by this UI.

## Local-first and server-first

Execution follows the configured mode. Local-first applies immediately and keeps its
normal durable synchronization. Server-first waits for acknowledgement and applies the
server's `appliedMethods`. There is no settlement-specific server-first override.

Client actor/time are caller-stated. The server stamps authenticated identity/time and
returns `settlementAudits`, keyed by tournamentId/drawId/requestId/matchUpId. Confirmation
merges only recordedBy/recordedAt; it never replays the sporting decision. The central
transport acknowledgement handler covers durable retries after reload, without a UI
callback. Later local edits and deleted draws are preserved; a missing settlement in an
existing loaded draw requests refresh. Repeated confirmations can retry failed local
persistence.

## Dependencies and review

Controls are hidden unless the loaded factory exposes settlement and individual-standings
methods. Package pins remain unchanged; no unpublished sibling is silently substituted.
This work needs a factory release containing the rotating-partner APIs before rollout.
The temporary consumer projections can be replaced with public factory types at that bump.

Unit tests cover permissions, eligibility, snapshots, preview mapping and audit
reconciliation. Playwright journey 153 covers required inputs, approval invalidation,
four-player preview, persistence and stale-result refusal against the feature factory.
It intentionally reports a missing factory capability rather than silently skipping.
Browser verification remains pending where the sandbox permits Chromium and Vite sockets.

The context adapter reads round pairing history from the copied tournament record.
The current factory getEvent projection corrupts nested tuple arrays; that separate
finding is recorded in Mentat's factory review handoff.
