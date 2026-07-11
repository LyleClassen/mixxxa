# Map: LLM playlist creation (chat panel)

Label: wayfinder:map

## Destination

An implementation-ready spec for an in-app chat panel that creates and edits playlists via LLM tool calling, with every chat persisted to the local DB so recurring prompting patterns can later be mined into first-class features.

## Notes

- Settled during charting (2026-07-11):
  - Surface order: in-app chat panel first; MCP server exposure of the same tool layer is a later phase.
  - Model: API provider first (Anthropic key in settings) behind a pluggable provider interface; local 0xbitnet can slot in later once stable under Bun/WebGPU.
  - Chat history: all sessions/messages/tool calls recorded in the local DB — this is a hard requirement, not telemetry.
- Design the tool layer so it is host-agnostic (chat panel today, MCP tomorrow).
- Skills: /grilling, /domain-modeling, /research (Anthropic API), /prototype (panel UI). Consult the claude-api skill for tool-use specifics.
- Tracker: local markdown (this directory).

## Decisions so far

<!-- one line per closed ticket -->

## Not yet specified

- MCP server exposure of the tool layer (phase 2) — shape depends on how the tool surface ticket lands.
- Prompt-pattern mining: how recorded chats turn into canned features/shortcuts — needs real usage data first.
- Local bitnet provider integration — blocked on WebGPU stability, tracked in memory/project-bitnet-webgpu.

## Out of scope

- Letting the LLM modify anything beyond playlists (track metadata, cues, library edits).
