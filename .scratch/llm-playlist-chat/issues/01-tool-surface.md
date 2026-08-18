# Define the playlist tool surface

Type: grilling
Status: open

## Question

Which tools does the LLM get, with what schemas and guardrails? Candidate set: `search_tracks` (by key/BPM/genre/energy/valence/systemReadiness…), `get_playlists`, `create_playlist`, `add_tracks_to_playlist`, `remove_tracks_from_playlist`, `reorder_playlist`. Decide: read vs write scope, whether writes need user confirmation in the chat UI, result pagination/size limits (token cost), and how track identity is passed (rekordbox id?).
