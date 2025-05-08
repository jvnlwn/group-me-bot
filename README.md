# group-me-bot

- Run `vercel dev` to run localally.
- Run `vercel --prod` to deploy to production.

## Get a Group Me API Access Token

- Go to https://dev.groupme.com/applications/new
- Set `GROUP_ME_API_ACCESS_TOKEN`

## Bots

### Create a bot

- Go to https://dev.groupme.com/bots
- Povide \*/group/:group_id/bot_callback as bot callback URL
- Set `GROUP_ME_*_GROUP_ID`
- Set `GROUP_ME_*_BOT_ID`

### Commands

- /poll: creates a yes/no poll.
- /nudge: @mentions all group members who have not voted in the poll.
