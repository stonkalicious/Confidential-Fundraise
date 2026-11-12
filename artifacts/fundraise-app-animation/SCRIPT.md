# Confidential Fundraising — App Walkthrough

## Director's treatment
- **Promise:** Fundraising interest can be coordinated without publishing individual commitment records.
- **Identity:** 16:9 landscape. Warm paper, aubergine ink, restrained oxide-red actions, and sage verification cues; Instrument Serif display, DM Sans interface, DM Mono metadata.
- **Hero:** The real app interface, treated as a tactile editorial instrument: large enough to read, with real workflow language and clear public/private boundaries.
- **Motion:** Interface assembled from ruled columns; exact fields type into place; public aggregate flips only after a founder marks a synthetic commitment verified; a privacy aperture cleanly separates the private record from the public total.
- **Arc:** Establish the promise, make a soft commitment, move into founder-only review, show the public aggregate update, then resolve on the honest limit: coordination and quote demos are not investment settlement.
- **Payoff:** The individual record folds into an unidentifiable aggregate bar while the closing disclaimer remains explicit.

## Shot timeline
Scenes 01A, 02A and 02B are a **proposed workflow** (badged `PROPOSED WORKFLOW` on screen). Founder and investor use their own agents outside the app; nothing here shows in-app file ingestion, AI review, or agent submission.

| Shot | Time | Focus | Main action | Handoff |
|---|---:|---|---|---|
| 01 | 0.00–3.00 | App identity and promise | Tagline snaps; app frame assembles | Rule → next scene |
| 01A | 3.00–9.50 | Founder prepares raise.md (proposed) | Founder prompts own agent; raise.md with sources + flagged gaps; founder approves public page | Rule draws under approval stamp |
| 02 | 9.50–14.50 | Public progress page | Aggregates only | Rule → investor scene |
| 02A | 14.50–21.50 | Investor asks, agent discovers (proposed) | One "I'm looking for X" request; agent scans public raises, marks matches, reads raise.md | Matches carry into shortlist |
| 02B | 21.50–29.00 | Agent review, human decides (proposed) | Shortlist; Evidence / Risks / Open questions; investor chooses to proceed; agent commits nothing | Rule → soft commitment |
| 03 | 29.00–34.00 | Soft commitment | unchanged | → founder view |
| 04 | 34.00–39.50 | Founder review | unchanged | → quote card |
| 05 | 39.50–45.00 | Privacy boundary, honest close | unchanged | Loop to 01 |

Shots 02–05 keep their original internal timings below; only their start offsets moved.

## Shot-by-shot script

### Shot 01 / 0.00–3.00s / 3.00s — “LIST YOUR PROJECT IN PUBLIC.”
**Purpose:** State the product's public discovery, private funding, and agent-update promise in one readable opening lockup.

**Exact content:** The Scene 1 tagline is `List your project in public. Fund it privately with Near. Let agents update it.` It assembles as large, readable text over the first 1.85 seconds. The existing app masthead and public progress panel remain visible beside it; no new copy is added.

**Composition:** Parchment ground, aubergine typography. Large live app window occupies the right half, cropped so its progress panel is recognizable; the left field holds the multi-line tagline at a large display size. A vermilion vertical rule anchors the safe left edge; the actual app's green-and-black logo sits in its cream masthead.

**Artistic idea:** The tagline assembles line by line in percussive typographic beats beside the working interface, turning the promise immediately into a recognizable tool.

**Timed choreography:** 0.00–0.39: `List your project` snaps in at the 8.5% inset; the red rule is already visible. 0.39–0.76: `in public.` lands beneath it. 0.76–1.12: `Fund it privately` joins. 1.12–1.48: `with Near.` lands. 1.48–1.84: `Let agents` joins, followed by `update it.` at 1.84. The app window folds open from its top rule; its masthead and progress figure settle alongside the completed tagline. The underline extends into the next shot's progress rail; no dead hold.

**Transition contract:** The underline continues across the cut as the public progress panel's threshold rule. The app window remains the visual carrier; the headline exits upward while the screen scales slightly larger.

**Assets and technique:** Existing `fundraising-logo.png` from the source app, locally copied into this artifact; hand-built UI artwork matching the supplied app source; CSS / SVG rules and type, no live app embed or invented live data.

**Sound intent:** Instrumental bed with crisp first accents; planned cut at 3.00s, alignment unverified until bed analysis.

### Shot 01A / 3.00–9.50s / 6.50s — "FOUNDER PREPARES." (PROPOSED)
**Exact content:** Kicker `01A / FOUNDER PREPARES`; badge `PROPOSED WORKFLOW`; card `FOUNDER → OWN AGENT` / `OUTSIDE THE APP`; prompt `Create a raise.md from our company materials. Include sources and flag missing information.`; reply `Drafted raise.md · sources cited · 2 gaps flagged`; document `raise.md` with `# Privacy Token Fund`, `## Thesis`, `## Sources` `[1] company deck · [2] public repo`, `## Missing information` `! Flagged for founder · not filled in by the agent`; `FOUNDER REVIEW` + artwork `Approve public raise page`; stamp `APPROVED BY FOUNDER · THEN PUBLIC`.
**Choreography:** 0.35–1.6 prompt words reveal; 1.9 reply + doc rises; 3.9 review strip; 5.0 press + stamp; 5.7 rule draws.

### Shot 02A / 14.50–21.50s / 7.00s — "THE AGENT SEARCHES." (PROPOSED)
**Exact content:** Kicker `02A / INVESTOR ASKS · AGENT SEARCHES`; `INVESTOR → OWN AGENT`; single request `I'm looking for [X]. Find matching public raises and review them critically.` (X left as an explicit placeholder — no invented mandate); aside `One request. The investor does not browse or filter.`; agent log `Exploring public raises` → `Matching against your request` → `Reading raise.md + public sources`; right column `APP · PUBLIC RAISES (READ BY AGENT)` with five synthetic rows; three marked `match` then `raise.md read`, others dimmed. No cursor, no filter controls.
**Choreography:** 0.4 request; 2.3 sweep lines scan rows; 3.7 matches lit; 5.0 raise.md read.

### Shot 02B / 21.50–29.00s / 7.50s — "YOU DECIDE." (PROPOSED)
**Exact content:** Kicker `02B / AGENT RETURNS A SHORTLIST`; `SHORTLIST` three rows; aside `A critical review, not a certification.`; review card `Privacy Token Fund` with headings `Evidence` (`Cited from raise.md and public sources.`), `Risks` (`Gaps and assumptions the agent flagged.`), `Open questions` (`To ask the founder before any commitment.`); bar `YOU DECIDE` · `The agent commits nothing.` · `Proceed?` → `Proceeding with Privacy Token Fund`.
**Choreography:** headings land 0.7 / 1.5 / 2.3; decision bar 3.1; investor choice 5.0; rule 5.9 leads into Shot 03's soft commitment.

### Shot 02 / 3.00–8.00s / 5.00s — “THE PUBLIC VIEW.”
**Purpose:** Demonstrate the progress view exposes only aggregate fundraising data.

**Exact content:** UI masthead `Privacy Token Fund`; tab `01 Progress` highlighted; eyebrow `PUBLIC PROGRESS`; heading `$420,000`; target `of $2,000,000`; bar label `HARD COMMITMENTS`; secondary metrics `SOFT INTEREST  $86,500` and `HARD COMMITMENTS  $420,000`; note `Individual commitment details are not shown here.` At 6.35 a small outlined callout: `AGGREGATES ONLY`.

**Composition:** Full-width dark aubergine application top rail, parchment body. Large progress panel centered, occupies ~78% of short edge; headline total owns left half, precise target and a long red bar span right half. Bottom data strip is split by one thin rule; no investor names or amounts are shown. Safe margins 6%.

**Artistic idea:** The progress fill grows from the underline inherited from Shot 01, but the bar is deliberately aggregate and not a stack of individual marks. A blank record column on the screen remains visibly empty to signal what is withheld.

**Timed choreography:** 0.00–0.45: window completes push-in; `PUBLIC PROGRESS` and masthead settle. 0.45–1.05: `$420,000` rolls upward through a few numerals then lands; target enters from the opposite side. 1.05–2.00: red progress rail draws from zero to 21%; bar endpoint stops with a sharp tick. 2.10–2.75: soft and hard aggregate labels reveal sequentially. 3.00–3.65: `AGGREGATES ONLY` frames the empty records region; pointer-like focus ring passes over the aggregate, never over private detail. 3.90–4.45: note becomes legible; window shifts left and Prospect tab lights up. 4.45–5.00: tab's lower border pulls outward into a writing line that crosses the cut.

**Transition contract:** A hard cut rides the drawn tab underline; the UI's left navigation is retained but the center content is replaced by the prospect form. At least two mechanics combine: screen push and carried tab rule.

**Assets and technique:** CSS UI, large Instrument Serif totals, DM Mono data labels, SVG progress rail. No fabricated logo; existing app mark carries through.

**Sound intent:** Bed continues; planned 8.00s cut lands on a musical accent if one is present.

### Shot 03 / 8.00–13.00s / 5.00s — “SOFT MEANS INTEREST.”
**Purpose:** Show that a prospect can record an amount without transferring funds or needing a wallet.

**Exact content:** Selected tab `Prospect`; form title `Submit a soft commitment`; label `IDENTIFIER`; typed value `demo-investor-001`; label `AMOUNT`; typed value `$10,000`; CTA artwork `Submit soft commitment`; success record `Soft commitment recorded`; exact caveat `Interest only · no money sent.` Footer `Wallet not required.` Keep all identifiers synthetic.

**Composition:** Light form composition, nearly full-width center-left; thin vertical oxide line divides the form from a narrow margin note at right `NO WALLET / NO TRANSFER`. The real-looking but noninteractive button is lower-left. On submit, form compresses into a long anonymized paper-like record row centered across the canvas.

**Artistic idea:** Cursor focus advances field to field and the exact synthetic strings appear, then the entire form becomes a sealed record strip. A red submit rule is not a payment arrow: it terminates in a small hollow square and a no-transfer annotation.

**Timed choreography:** 0.00–0.35: Prospect tab's carried underline draws on; form outline resolves. 0.45–1.05: cursor enters identifier field; characters reveal in 50ms groups. 1.15–1.85: amount counts into `$10,000`, then stops. 2.05–2.45: visual submit button presses in and releases; it is artwork only. 2.55–3.20: success status and hollow square stamp appear, with no coins or transfer animation. 3.20–3.85: `Interest only · no money sent.` and `Wallet not required.` reveal in opposite corners. 4.00–4.55: form folds into the record strip, private ID sits behind a privacy mask. 4.55–5.00: strip travels right as the canvas splits to reveal the Founder view, carrying the strip into its first record row.

**Transition contract:** Record strip enters the founder panel at the same vertical coordinate. Form outline becomes the Founder section's private review boundary.

**Assets and technique:** Hand-built UI; deterministic per-character reveals with Framer Motion; no interactive HTML controls. Aesthetic stays true to source app.

**Sound intent:** Music bed only; a light rhythmic accent on the submit press, not an added SFX.

### Shot 04 / 13.00–18.50s / 5.50s — “A FOUNDER REVIEWS.”
**Purpose:** Make clear that the founder can inspect the individual record privately, and that verification is an explicit founder action.

**Exact content:** Header `Founder review · PRIVATE`; guidance `Mark hard only after confirmation.` Private record `demo-investor-001` / `$10,000` / `SOFT`; visual-only control `Mark verified (demo)`; status changes to `HARD · VERIFIED (DEMO)`; public aggregate `$430,000`; footer disclaimer `Demo status only. No funds moved.`

**Composition:** Split-screen, left 58% deep aubergine private review table, right 42% pale public-total inset with `$420,000` at entry. Clearly labeled private boundary above the founder area. Record owns the screen; action control remains artwork, center-left. Public aggregate is separate and never displays the identifier.

**Artistic idea:** A single private record is admitted through a narrow aperture into the review boundary. A founder verification stamp changes its local state. On the right, only a detached aggregate odometer increments from $420,000 to $430,000 as the amount identity disappears behind an opaque shutter.

**Timed choreography:** 0.00–0.45: inherited record strip resolves inside the aubergine boundary; `PRIVATE` label appears first. 0.55–1.25: masked synthetic identifier and `$10,000` reveal; status remains `SOFT`. 1.60–2.05: `Mark verified (demo)` focus frame locks, then presses inward at 2.10. 2.20–2.75: sage `HARD · VERIFIED (DEMO)` stamp rotates 2 degrees and settles beside the record, not above the amount. 2.80–3.60: right-side public total counts to `$430,000`; no identifier crosses the vertical divider. 3.65–4.30: total threshold rail advances; caption `Demo status only. No funds moved.` appears. 4.30–4.85: the row's identifier is closed by a sliding opaque panel while the aggregate bar remains visible. 4.85–5.50: divider narrows toward center and its line continues into a dark quotation card.

**Transition contract:** The privacy shutter becomes the outer frame of the final quote panel; the public aggregate bar carries over, at the same scale and value. The private identifier remains hidden.

**Assets and technique:** CSS split panel, type, border, and status stamp. No real credentials, investor records, network quote, or transfer. `$420,000` and `$430,000` are illustrative demo state, explicitly not live results.

**Sound intent:** Strongest instrumental accent at verification stamp if available; cut at 18.50s to the next downbeat, timing to be confirmed after generation.

### Shot 05 / 18.50–24.00s / 5.50s — “COORDINATION ≠ SETTLEMENT.”
**Purpose:** Finish with a memorable privacy principle and truthful boundaries around the optional NEAR Intents demo.

**Exact content:** Quote card heading `NEAR INTENTS · OPTIONAL DEMO`; label `FIXED EXAMPLE`; amount `1 USDC`; route `Ethereum → Arbitrum`; animated wallet-authentication sequence `Connect NEAR wallet` → `Approve authentication · empty intent` → `Confidential quote returned`; badge `DRY-RUN QUOTE`; prominent `NO FUNDS MOVE`; legal note `A quote is not a payment or investment settlement.` Final lockup `Public totals. Private records.` with `DEMO ONLY · SYNTHETIC DATA`. No claim of successful live quote or onchain settlement.

**Composition:** Quote UI occupies a left 45% framed by the inherited shutter; right field is a warm cream panel with giant three-line message, high contrast and 6% safe inset. Within the quote card, a prominent ruled NEAR wallet-authentication panel sits beneath the fixed example route. Its three large rows and advancing oxide progress rail read as an intentional wallet flow, not a token-transfer animation. At the finale, both regions contract into a single ruled lockup on muted cream; actual app logo appears against a contrasting cream ground (never recolored).

**Artistic idea:** The `1 USDC` is a tiny fixed example inside a labeled dry-run field, not an animated payment token. The route is a thin line that terminates at a hollow bracket; it never becomes a transfer stream. The divider closes like a book, leaving only the privacy promise and explicit disclaimer.

**Timed choreography:** 0.00–0.55: quote card edge resolves from the shutter; aggregate bar visibly stays separate behind it. 0.52: the first wallet row `Connect NEAR wallet` advances and the progress rail begins. 1.26: `Approve authentication · empty intent` takes focus; no signing payload or value movement is depicted. 1.98: the authentication panel completes and the focus returns to `Confidential quote returned`; `DRY-RUN QUOTE` and `NO FUNDS MOVE` resolve beneath it. These are authentication-only beats, not a transfer. 0.60–1.25: `1 USDC` and route type in. 1.40–2.05: route line draws and ends at an open bracket, no movement of value. 2.10–2.60: `NO FUNDS MOVE` remains prominent in oxide red; the settlement disclaimer remains explicit. 3.05–3.65: both columns fold inward; the quote amount is boxed and recedes. 3.75–4.25: large end copy `Public totals. Private records.` enters in three measured lines. 4.25–4.85: logo and `DEMO ONLY · SYNTHETIC DATA` resolve on cream. 4.85–5.50: underline retracts toward its left origin in a visible looping gesture and cuts back to Shot 01's opening rule; logo remains for first frame match.

**Transition contract:** Final underline ends at the same left anchor and scale as Shot 01's vermilion rule; the logo has cream surrounding it in both shots. The final lockup exits through a shutter that echoes the original app-window reveal. No empty wipe tail.

**Assets and technique:** Existing supplied logo; UI and quote card recreated as graphic artwork; Instrument Serif close, DM Sans and mono labels; explicit legal boundary copy.

**Sound intent:** Instrumental has a resolved cadence under the message; loop reset at 24s. No VO or SFX requested.

## Audio spec
- Runtime: 45 s (`SCENE_DURATIONS` total: 3 + 6.5 + 5 + 7 + 7.5 + 5 + 5.5 + 5.5).
- Music: the existing original instrumental bed, re-edited (no new generation). The 24 s source is kept at `public/audio/source/bg_music_24s.mp3`; `bg_music.mp3` is an ffmpeg concat of its own phrases so every scene starts on the same bed material and the original cadence still resolves under Shot 05: 0–3 | 8–13+8–9.5 | 3–8 | 13–18.5+13–14.5 | 8–13+3–5.5 | 8–13 | 13–18.5 | 18.5–24. 40 ms fades at each splice. No VO or SFX.
- Playback file: `bg_music.mp3` (45.06 s). Audio seeks to cumulative scene offsets derived from `SCENE_DURATIONS`.
