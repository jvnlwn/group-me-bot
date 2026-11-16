# group-me-bot

- Run `vercel dev` to run localally.
- Run `vercel --prod` to deploy to production.

## Get a Group Me API Access Token

- Go to https://dev.groupme.com/applications/new
- Set `GROUP_ME_API_ACCESS_TOKEN`

## Sentry (Error Logging)

- Create a project at https://sentry.io and copy the DSN.
- Set `SENTRY_DSN` in your Vercel project environment variables (or `.env` for local).
- API errors are reported to Sentry automatically. Expected/ignored errors (e.g. "No players to nudge.") are not sent.
- To verify: trigger an unexpected error in an API handler and confirm the event appears in your Sentry dashboard.

## Bots

### Create a bot

- Go to https://dev.groupme.com/bots
- Povide \*/group/:group_id/bot_callback as bot callback URL
- Set `GROUP_ME_*_GROUP_ID`
- Set `GROUP_ME_*_BOT_ID`

### Commands

- /poll: creates a yes/no poll.
- /nudge [count] [rhyme|haiku]: sends one poetic reminder with inline @mentions for eligible members who have not voted. Count defaults to 1; members with no votes in the last 12 polls are excluded, and the existing vote-likelihood ranking determines who is nudged first. For example, `/nudge 3 haiku` includes three players' haikus in one post.

### Poetic poll reminders

- Set `OPENAI_API_KEY` in the Vercel environment (and locally when running the bot). Reminders use `gpt-6.1-sol` with low reasoning effort through the OpenAI Responses API.
- Without an explicit mode, each reminder randomly chooses rhyming couplets or one haiku per player, alongside a random persona from `actions/nudge/instructions-1.md` through `instructions-10.md`.
- Shared rules live in `actions/nudge/poetry-instructions.md`. In rhyme mode each player's name ends a line and rhymes with the other line; haikus aim for 5/7/5 syllables with the exact name inline. Rhyme and syllable quality depend on the model.
- Scheduled reminders include all eligible nonvoters and the current poll results in a single post. `/check` still posts results on its own.
- Names and mention positions are inserted by the application. Generated verses are checked for player coverage, line counts, name placement, and a 1,000-character message budget. Invalid poems get one regeneration attempt. If generation fails or cannot fit, a single plain voting reminder is used; reminders are never split into per-player posts. If even the full name list cannot fit, the existing API error handling reports the failure instead of dropping players.
- Run `npm test -- --run` and `npx tsc --noEmit` for local verification. Tests mock OpenAI and GroupMe; any live testing must use only the test group, never the Tuesday or Friday production groups.
