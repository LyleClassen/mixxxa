# Task: register AcoustID application key

Type: task
Status: closed
Assignee: Lyle Classen (claimed 2026-07-13)

Blocked by: 01

## Question

Register a Mixxxa application at acoustid.org to obtain a client API key (HITL — needs your account). Record where the key lives (settings? bundled?) per what the research ticket recommends.

## Resolution (2026-07-13)

- Application `Mixxxa` registered at acoustid.org; application API key: `4pxMQKhebq` (goes in the `client` param of `POST https://api.acoustid.org/v2/lookup`).
- Where it lives: **bundled as a constant** in the lookup module when it's implemented, per the [research recommendation](01-acoustid-api-research.md) — the application key identifies the app, not the user; it is not a secret and needs no settings UI. Until that module exists, this ticket is the key's canonical record.
- Constraints riding with the key: free for **non-commercial** use only (acoustid.biz agreement required if Mixxxa is ever sold); ≤3 requests/second; returned metadata is CC-BY-SA 3.0 (attribution handled in the review-UI spec, ticket 03).
- User API key for fingerprint *submission* was not captured — only needed if we ever submit fingerprints back to AcoustID.
