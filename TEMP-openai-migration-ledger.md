# OpenAI model migration ledger

Application: GroupMe soccer poll reminder bot.
Mode: implementation, explicitly requested November 16, 2026, alongside live testing in Bot Test only.
Approved stage: update the poem model and necessary compatibility controls, then validate locally and in Bot Test. The user subsequently authorized committing, pushing, and deploying these changes to Vercel. Do not send test messages to the Tuesday or Friday groups.
Existing integration: OpenAI Node SDK 4.96.0, direct Responses API, one shared createPoeticReminder path used by manual nudges and scheduled reminders.
Selected integration: same SDK and endpoint, gpt-6.1-sol with low reasoning effort.
Credential decision: use the new key saved by the user in .env. Do not disclose or rotate it.
Privacy: preserve store: false and existing stateless requests. Account-level ZDR and residency are unknown; no new state, regional routing, or retention configuration is introduced or claimed.

## Scope and evidence

The user requested a model update, rather than a broader API or framework migration. There is one model call in actions/nudge/poetry.ts. Manual and scheduled reminders share it. The current buffered, schema-validated single-message contract remains required.

GPT-6 Luna successfully authenticated but its live poem duplicated part of a full name and missed haiku meter. That output was not posted. GPT-6.1 Sol is the selected candidate for stronger adherence to these constraints. The shared instructions now explicitly explain whole-name replacement and counting a full name's syllables.

Official sources checked November 16, 2026:
- https://developers.openai.com/api/docs/models/gpt-6.1-sol
- https://developers.openai.com/api/docs/models/gpt-6-luna
- https://developers.openai.com/api/docs/guides/latest-model

## Capability review

- Model selection: applicable, supported; selected Sol/low for poetry quality. Live output review passed: a full-name near-rhyming couplet and a 5/7/5 haiku.
- Instruction file naming: applicable, already present; preserve all persona filenames and shared poetry rules.
- Chat Completions migration: not applicable; both invocation modes already use Responses.
- Streaming: not applicable; the complete poem must validate before a single GroupMe post.
- WebSocket mode: not applicable; short independent HTTP requests without tool loops.
- Data privacy and residency: applicable; preserve existing global endpoint and store: false. ZDR is not inferred from that flag.
- Processing tiers: preserve existing default processing for the same short request path. Priority/Flex/Batch/reserved routing is outside this model-update stage.
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

## Workflows and validation

- Manual /nudge: shared Sol/low request; unit tests assert both rhyme and haiku request controls and exactly one post with mentions/reply.
- Scheduled poll_reminder: same model path; unit tests cover combined results plus poetry in one message.
- Live test: use only Bot Test, verified bot-to-group mapping, no production groups, at most one post for each mode. The test group has one member, no active poll, and no historical votes, so directly exercise the production poem generator and post helper rather than changing poll state or eligibility.
- Baseline: 23 reminder tests and TypeScript pass. The full suite has two pre-existing offset parsing failures, each also discovered in stale .vercel build output.
- Current status: complete. Both Sol-generated modes were accepted by GroupMe (202), then read back from Bot Test with exactly one matching message per mode and identical mention IDs/loci.
- Live delivery evidence: rhyme message 179485642222882667; haiku message 179485642236740276. Both sent only to Bot Test; no production writes or deployment occurred during live testing.
- Final validation: 23 reminder tests pass, npx tsc --noEmit passes, and git diff --check passes. npm test -- --run reports the same two pre-existing offset parser failures, duplicated under .vercel/output/static (49 passed, 4 failed). No migration regression identified.
- Test limit: live testing covers real model generation and real post/mention delivery for the test group's single member. Full reminder selection/scheduling and multiple recipients are covered by mocked tests; no test poll or voting history was fabricated.

Deployment is authorized as a follow-up to the model-update request. Verify build and deployment status without invoking production messaging endpoints. No broader API migration is required.
