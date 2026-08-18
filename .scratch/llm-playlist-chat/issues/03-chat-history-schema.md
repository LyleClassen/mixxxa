# Chat history schema in local DB

Type: grilling
Status: open

Blocked by: 01

## Question

Model the persisted chat record: sessions, messages, tool calls + results, token usage. Decide granularity (store raw API messages verbatim vs a normalized shape), retention (keep forever? size cap?), and what indexing is needed to support future prompt-pattern mining. Blocked by the tool surface ticket because tool-call shapes are part of the record.
