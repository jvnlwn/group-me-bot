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
- /nudge: @mentions all group members who have not voted in the poll.
