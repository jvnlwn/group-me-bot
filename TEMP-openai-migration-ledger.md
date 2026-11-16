# OpenAI model migration ledger

Application: GroupMe soccer poll reminder bot.
Mode: implementation, explicitly requested November 16, 2026, alongside live testing in Bot Test only.
Approved stage: update the poem model and necessary compatibility controls, then validate locally and in Bot Test. The user subsequently authorized committing, pushing, and deploying these changes to Vercel. Do not send test messages to the Tuesday or Friday groups.
Existing integration: OpenAI Node SDK 4.96.0, direct Responses API, one shared createPoeticReminder path used by manual nudges and scheduled reminders.
Selected integration: same SDK and endpoint, gpt-6.1-sol with low reasoning effort and Fast processing, explicitly requested as a latency follow-up.
Credential decision: use the new key saved by the user in .env. Do not disclose or rotate it.
Privacy: preserve store: false and existing stateless requests. Account-level ZDR and residency are unknown; no new state, regional routing, or retention configuration is introduced or claimed.

## Scope and evidence

The user requested a model update, rather than a broader API or framework migration. There is one model call in actions/nudge/poetry.ts. Manual and scheduled reminders share it. The current buffered, schema-validated single-message contract remains required.

GPT-6 Luna successfully authenticated but its live poem duplicated part of a full name and missed haiku meter. That output was not posted. GPT-6.1 Sol is the selected candidate for stronger adherence to these constraints. The shared instructions now explicitly explain whole-name replacement and counting a full name's syllables.

Official sources checked November 16, 2026:
- https://developers.openai.com/api/docs/models/gpt-6.1-sol
- https://developers.openai.com/api/docs/models/gpt-6-luna
- https://developers.openai.com/api/docs/guides/latest-model
- https://developers.openai.com/api/docs/guides/fast-mode

## Capability review

- Model selection: applicable, supported; selected Sol/low for poetry quality. Live output review passed: a full-name near-rhyming couplet and a 5/7/5 haiku.
- Instruction file naming: applicable, already present; preserve all persona filenames and shared poetry rules.
- Chat Completions migration: not applicable; both invocation modes already use Responses.
- Streaming: not applicable; the complete poem must validate before a single GroupMe post.
- WebSocket mode: not applicable; short independent HTTP requests without tool loops.
- Data privacy and residency: applicable; preserve existing global endpoint and store: false. ZDR is not inferred from that flag.
- Processing tiers: the latency follow-up explicitly requests a fast model/mode. Set service_tier: "fast" for both manual and scheduled reminders, retaining Sol/low to preserve the tested poetry behavior. Fast costs twice Standard for Sol. Flex, Batch, reserved routing, and Ultrafast are outside this request.
- Prompt caching: no cache configuration change is needed for this model-only update. Random personas and infrequent independent requests provide limited reuse.
- Prompt cache keys: no key is currently configured; none added for GPT-6.
- Extended cache retention: earlier-model guidance is not applicable; no retention change.
- Explicit cache breakpoints: no approved caching change in this stage; SDK 4.96.0 does not expose the newer cache options in its request types.
- Cache diagnostics: no stored recent response ID exists in this stateless workload; no diagnostics pipeline added.
- State management: already stateless; no conversation or replay.
- Instruction persistence: already present; top-level instructions are resent on each generation attempt.
- Reasoning: applicable, supported; low effort controls cost and latency for constrained short poems.
- Encrypted reasoning replay: not applicable; requests do not continue earlier model turns.
- Reasoning preservation: not applicable; no cross-turn history.
- Reasoning summaries/preambles: not applicable to the poem-only product output; none exposed.
- Verbosity: preserve the existing explicit line-count and character budget instead of adding an SDK upgrade solely for a new verbosity option.
- Maximum output tokens: preserve 2000, including reasoning; completed status is required and incomplete output uses existing recovery.
- Assistant message phases: not applicable; no assistant-history replay or tool loop.
- Context compaction: not applicable; bounded prompts with no accumulating history.
- Structured outputs: applicable, supported; preserve the Zod schema, parsing, validation, retry, and fallback.
- Tool choice: not applicable; the model has no tools.
- Tool search/additional tools: not applicable; no tool catalog.
- Parallel tool calls: not applicable; no tool execution.
- Programmatic tool calling: not applicable; no tool orchestration.
- Model-aligned tool interfaces: not applicable; no custom model tools.
- New GPT-6 async calling, steering, and multi-agent capabilities: not applicable to this single-response workload.

## Initial workflows and validation

- Manual /nudge: shared Sol/low request; unit tests assert both rhyme and haiku request controls and exactly one post with mentions/reply.
- Scheduled poll_reminder: same model path; unit tests cover combined results plus poetry in one message.
- Live test: use only Bot Test, verified bot-to-group mapping, no production groups, at most one post for each mode. The test group has one member, no active poll, and no historical votes, so directly exercise the production poem generator and post helper rather than changing poll state or eligibility.
- Baseline: 23 reminder tests and TypeScript pass. The full suite has two pre-existing offset parsing failures, each also discovered in stale .vercel build output.
- Current status: complete. Both Sol-generated modes were accepted by GroupMe (202), then read back from Bot Test with exactly one matching message per mode and identical mention IDs/loci.
- Live delivery evidence: rhyme message 179485642222882667; haiku message 179485642236740276. Both sent only to Bot Test; no production writes or deployment occurred during live testing.
- Final validation: 23 reminder tests pass, npx tsc --noEmit passes, and git diff --check passes. npm test -- --run reports the same two pre-existing offset parser failures, duplicated under .vercel/output/static (49 passed, 4 failed). No migration regression identified.
- Test limit: live testing covers real model generation and real post/mention delivery for the test group's single member. Full reminder selection/scheduling and multiple recipients are covered by mocked tests; no test poll or voting history was fabricated.

Deployment is authorized as a follow-up to the model-update request. Verify build and deployment status without invoking production messaging endpoints. No broader API migration is required.

## Fast mode follow-up

- Objective and scope: implement the user's request for Fast mode, verify locally, then use the existing Git-triggered deployment workflow. The suspected Vercel timeout is unconfirmed. No GroupMe messages are needed for this validation.
- Compatibility: current official documentation supports service_tier: "fast" on Responses with gpt-6.1-sol. SDK 4.96.0's service_tier union predates Fast/Priority, but its README explicitly supports newer request values with a targeted @ts-expect-error, forwarding them unchanged. Keep the installed SDK and schema parser; verify the actual HTTP request and response tier in a local smoke test.
- Behavior: keep low reasoning effort, the 2000-token output cap, store: false, persona prompts, validation, one regeneration attempt, single GroupMe post, and fallback. All earlier capability-review entries remain applicable except processing tiers.
- Timeout evidence: each OpenAI request has a 15-second timeout and no SDK retries; two validation attempts can take roughly 30 seconds before GroupMe work. No explicit duration appears in vercel.json or the project's returned resourceConfig. This does not establish the effective deployed limit or prove a function timeout.
- Validation: all 57 tests pass, including Fast-tier assertions for both poem modes, and npx tsc --noEmit passes. The separate offset-parser fix and generated-build exclusion remain green.
- Live OpenAI-only smoke check: both requests returned HTTP 200, completed status, and service_tier: "fast"; the production generator validated both poems and mention mappings for synthetic names Sam and May. Rhyme completed in 6.367 seconds and haiku in 4.075 seconds, with one request per mode and zero GroupMe requests. These are two local observations, not a latency guarantee, a Standard-versus-Fast benchmark, or proof that a Vercel timeout is fixed.

## Function timeout and mentions follow-up

- Actual production timeout checked November 16, 2026: project defaultResourceConfig.fluid is false and functionDefaultTimeout is 10 seconds. Deployment dpl_91Yr3evGZ8kJko7PsE6gneWgj4hE reports config.functionTimeout: 10, plan: hobby, and no function-duration overrides.
- Set maxDuration: 60 specifically for bot_callback and poll_reminder in vercel.json. The two OpenAI attempts remain bounded at 15 seconds each with SDK retries disabled, leaving roughly 30 seconds for startup and GroupMe I/O. This is within Vercel's Hobby limit without enabling Fluid compute; stalled external I/O can still exhaust the allowance.
- Add mentions mode to /nudge and the random rotation. It uses the same eligibility and ranking, renders exact comma-separated @names with mention positions, and calls no model. Scheduled reminders still combine results and the selected reminder in one post.
- Validation covers an eight-player reminder with two simulated 14-second generation attempts and only one final post, plus mention-mode command syntax, duplicate/Unicode names, prefix offsets, no OpenAI calls, and single-message limits. All live verification for this follow-up uses deployment metadata; no GroupMe test messages are sent.
- All 65 tests pass. The application and both test files pass TypeScript checks; git diff --check passes. Glob resolution confirms the two reminder entry points receive the 60-second override and other functions retain their project default.
