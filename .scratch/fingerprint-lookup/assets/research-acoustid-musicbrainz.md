# AcoustID + MusicBrainz fingerprint-lookup research

Researched 2026-07-13 against primary sources only: acoustid.org/webservice, acoustid.org/faq, acoustid.org/license, musicbrainz.org/doc/MusicBrainz_API (+ Rate_Limiting), the chromaprint repo source, and the local `@unimusic/chromaprint@0.1.4` package + our patch.

## 1. AcoustID lookup request format

Source: https://acoustid.org/webservice

- **Endpoint**: `https://api.acoustid.org/v2/lookup` — supports **GET and POST**. POST is recommended because "the audio fingerprints get fairly long, compressed POST requests are prefered." A 120s fingerprint is ~2–3 KB base64, so GET can hit URL-length limits; use POST (form-encoded body).
- **Required params**:
  - `client` — application API key
  - `duration` — "duration of the whole audio file in seconds" (integer; **full track**, not the 120s fingerprinted window)
  - `fingerprint` — Chromaprint compressed fingerprint string
- **`meta` param** (optional, `+`-separated): `recordings`, `recordingids`, `releases`, `releaseids`, `releasegroups`, `releasegroupids`, `tracks`, `compress`, `usermeta`, `sources`. Without `meta` you get only AcoustID track IDs + scores. `compress` shrinks the JSON by de-duplicating repeated structures.
- **Gzip request body**: "Our web server supports GZip-compressed bodies for HTTP POST requests. If you compress the body using GZip and set the 'Content-Encoding' HTTP header to gzip, we will decode it before parsing."
- **Response envelope**: JSON by default (XML available; JSONP via `jsoncallback`):
  ```json
  { "status": "ok", "results": [ { "id": "<acoustid-track-uuid>", "score": 0.97, "recordings": [ ... ] } ] }
  ```
  On error: `{ "status": "error", "error": { "code": N, "message": "..." } }`.
- **Rate limit**: "Do not make more than 3 requests per second."

## 2. Compatibility of our fingerprint output

Sources: `src/bun/analysis/fingerprint.ts`, `patches/@unimusic%2Fchromaprint@0.1.4.patch`, `node_modules/@unimusic/chromaprint/dist/index.js`, https://raw.githubusercontent.com/acoustid/chromaprint/master/src/chromaprint.h, https://raw.githubusercontent.com/acoustid/chromaprint/master/src/cmd/fpcalc.cpp

- **Algorithm: compatible.** The package's `defaultConfig.algorithm = ChromaprintAlgorithm.Default = 1` (`node_modules/@unimusic/chromaprint/dist/index.js` lines 21–36), and our patched `fingerprintPcm` passes that to `Module._chromaprint_new(fullConfig.algorithm)`. In chromaprint.h, enum value 1 is `CHROMAPRINT_ALGORITHM_TEST2`, and `CHROMAPRINT_ALGORITHM_DEFAULT` maps to `CHROMAPRINT_ALGORITHM_TEST2` — exactly what AcoustID's server indexes.
- **Output format: compatible.** `getFingerprint` (rawOutput=false, our default) calls `Module._chromaprint_get_fingerprint(ctx, fpPtr)` which per chromaprint.h returns "the calculated fingerprint as a compressed string" — the compressed, **URL-safe-base64** encoding (chromaprint's `chromaprint_encode_fingerprint` with base64=1). This is the same string fpcalc prints as `FINGERPRINT=` and what the AcoustID `fingerprint` param expects. No re-encoding needed.
- **Duration fingerprinted: compatible.** `fingerprint.ts` caps at `FINGERPRINT_SECONDS = 120` of mono PCM, matching fpcalc's default (`-length SECS ... default 120`, `static double g_max_duration = 120;` in fpcalc.cpp). The package also independently caps at `maxDuration: 120`.
- **Channels**: we downmix to mono and call `fingerprintPcm(pcm, sampleRate, 1)`. Chromaprint itself downmixes multichannel input to mono before analysis, so feeding mono directly is equivalent — fingerprints match fpcalc output for the same audio (repo README notes input is converted internally; our smoke script `scripts/fingerprint-smoke.ts` can verify against fpcalc if needed).
- **Full-track duration: NOT currently captured.** `computeFingerprint` returns only `{ fingerprint, ms }` and `localDb.ts` stores only `fingerprint` + `time_fingerprint_ms`. AcoustID's `duration` param must be the **whole file's** duration in integer seconds. We do have `waveform_duration REAL` in the `content` table (written by `writeWaveformPeaks`), which is full-track — usable as `Math.round(waveform_duration)` — but the fingerprint path itself decodes only 120s (`decoder.ts` `maxSeconds`), so a track fingerprinted before waveform analysis may lack a duration. Decision needed (see Implications).

## 3. API key model

Sources: https://acoustid.org/webservice, https://acoustid.org/faq, https://acoustid.org/license

- **Two key types** (FAQ): an **application API key** ("client" param) obtained by registering at https://acoustid.org/new-application (requires an AcoustID login), and a **user API key** used only for the `submit` endpoint to attribute contributions. Lookup needs only the application key.
- **Rate limit**: 3 requests/second (webservice page, quoted above). Confirmed.
- **Commercial terms** (webservice page): "This service is provided for free for non-commercial use only. If you would like to use the service in a commercial application, please sign up" at https://acoustid.biz/.
- **Data license** (license page): "The database of audio fingerprints and metadata is licensed under the Creative Commons Attribution-ShareAlike 3.0 Unported License" — attribution to AcoustID/MusicBrainz is expected if we display or store the metadata. Chromaprint library is LGPL 2.1 (we use it as an unmodified-algorithm WASM module via npm; the patch touches only JS glue).
- **Bundling the key**: the docs don't prohibit shipping the application key in a desktop app — that is the normal model (the application key identifies the app, not the user; e.g. the FAQ describes Picard shipping with its own application key while users optionally add a user key for submissions). The key is not a secret credential, but abuse counts against our app's identity.

## 4. MusicBrainz recording lookup — needed or not?

Sources: https://acoustid.org/webservice, https://musicbrainz.org/doc/MusicBrainz_API, https://musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting

- **AcoustID with `meta=recordings` already returns** per recording: MBID, `title`, `duration`, and `artists` (id + name, joined credit). Adding `meta=releasegroups` (or `releases`) nests release-group/release info (title, type, and with `releases` also date, country, track/disc positions, medium info). For a "which song is this?" review UI — title, artist, album — **a single AcoustID call with `meta=recordings+releasegroups+compress` is sufficient**; no MusicBrainz round-trip needed.
- **Follow-up MusicBrainz call is needed only for** data AcoustID doesn't proxy: full artist credits with join phrases, ISRCs, first-release-date, genres/tags, cover-art relationships, disambiguation. Format: `https://musicbrainz.org/ws/2/recording/<MBID>?inc=artists+releases&fmt=json` ("either set the Accept header to application/json or add fmt=json"; valid `inc` values for recordings include `artists`/`artist-credits`, `releases`, `release-groups`, `isrcs`).
- **MusicBrainz rate limit**: "All users of the API must ensure that each of their client applications never make more than ONE call per second." Enforced per IP at "(on average) 1 request per second"; exceeding it returns **503** "until the rate drops again".
- **Mandatory User-Agent**: "Each request sent to MusicBrainz needs to include a User-Agent header, with enough information ... to contact the application maintainers." Format `Application name/<version> ( contact-url )` or `( contact-email )`, e.g. `MyAwesomeTagger/1.2.0 ( me@example.com )`. Anonymous/default UAs get throttled or blocked. For us: `Mixxxa/<version> ( classenlyle@gmail.com )`.

## 5. Result shape for the review UI

Source: https://acoustid.org/webservice (response examples)

- `results` is an **array of AcoustID tracks**, each `{ id, score, recordings?: [...] }`. One fingerprint can match multiple AcoustID tracks, and each AcoustID track groups **multiple MusicBrainz recordings** (duplicates, remasters, different releases of the same audio). So the UI must expect a two-level candidate list: result → recordings[].
- `score` is a float **0..1** representing fingerprint match confidence (how similar the submitted fingerprint is to the stored one). The webservice page shows it in every example but does not formally define a threshold.
- Thresholds: no official guidance in the docs. Practical heuristic (ours, not sourced): treat ≥0.9 as a confident match suitable for auto-select, 0.5–0.9 as "show for review", and discard <0.5. Also prefer recordings whose `duration` is within a few seconds of our track's duration — AcoustID matches on the first 120s, so a radio edit and extended mix can both score high; duration disambiguates.
- Note: `recordings` may be absent on a result (fingerprint known but unlinked to MusicBrainz), and fields inside recordings can be missing — the parser must be defensive.

## Implications for Mixxxa

1. **Fingerprint pipeline is AcoustID-ready as-is**: algorithm 2 (TEST2), URL-safe compressed base64 string, 120s window — identical to fpcalc. Nothing to change in `src/bun/analysis/fingerprint.ts`.
2. **Missing piece: full-track duration.** AcoustID requires the whole file's duration in seconds; we don't persist it alongside the fingerprint. Options: (a) round `waveform_duration` at lookup time (risk: null if waveform not yet analyzed), (b) capture total decoded duration during the fingerprint decode and store it (decoder currently truncates at 120s for fingerprinting — would need the container/stream duration, not decoded-sample count), or (c) read duration from file metadata at lookup time. Decision needed; (a) with (c) as fallback is cheapest.
3. **One HTTP call suffices** for the review UI: POST `api.acoustid.org/v2/lookup` with `meta=recordings+releasegroups+compress` (gzip the body). Defer MusicBrainz to an optional enrichment step; if added, it needs its own 1 req/s limiter and a `Mixxxa/<version> ( contact )` User-Agent.
4. **Rate limiting**: batch lookups over a library must be throttled to ≤3 req/s (AcoustID) and ≤1 req/s (MusicBrainz). Build a small serial queue.
5. **Key + terms**: register an application key at acoustid.org/new-application and bundle it (normal for desktop apps). Service is free for **non-commercial** use only — if Mixxxa is ever sold, an acoustid.biz commercial agreement is required. Metadata is CC-BY-SA 3.0: show an AcoustID/MusicBrainz attribution line in the lookup UI.
6. **UI must handle ambiguity**: multiple results × multiple recordings per result, missing `recordings`, and near-tie scores; use track-duration proximity as a secondary ranking signal.
