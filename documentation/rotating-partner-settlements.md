# Rotating-partner settlements

## Director workflow

“Settle standings” is offered for terminal irregular results in applied Americano/Mexicano rounds, subject to provider permissions. The director selects EXCLUDE, PLAYED_POINTS or explicit CREDIT, records a reason, and previews the factory’s actual four-player standings impact. Editing the decision invalidates approval. Confirmation submits one settleRotatingPartnerResult through the normal mutation pipeline; stale results are refused without a write.

## Authentication and replay

CFS replaces recordedBy and recordedAt at its existing verified-identity boundary. Successful acknowledgements return appliedMethods whenever that boundary changed any command parameter, including presence attestations. Server-first execution replays ack.appliedMethods ?? the original methods through the factory. No settlement receipts, direct record edits or settlement-specific reconciliation are used.

Server present ⇒ the server’s identity wins. Server absent ⇒ the client’s claim stands.
Local-first mode still applies immediately and retains local values; server processing uses the syncing operator and server clock. Later convergence of local-first copies is a general synchronization concern, not implemented by this feature.

## Dependencies and merge gates

The package pin is factory 7.11.0, which includes the settlement API and getEvent nested-array fix. Pairing history uses getEvent({ drawId }); getTournament supplies permissions and participant names. The consumer branch remains a draft until published-dependency checks, Playwright journey 153 and HTTP/Postgres integration pass.

The separate factory retry change preserves the original actor/time when sporting intent matches a repeated requestId. It requires a subsequent CA-authorized factory release. Until consumers bump to that release, CFS retains its prior-record retry lookup for compatibility with 7.11.0.
