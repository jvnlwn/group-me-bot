import { captureGroupMeApiError } from "../lib/sentry"
import { GroupMeAttachment } from "../types"

type PostOptions = {
  botId: string
  text: string
  attachments?: GroupMeAttachment[]
}

async function post({ botId, text, attachments }: PostOptions) {
  const token = process.env.GROUP_ME_API_ACCESS_TOKEN as string
  const response = await fetch(
    `https://api.groupme.com/v3/bots/post?token=${token}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        bot_id: botId,
        text,
        attachments
      })
    }
  )

  if (response.status !== 202) {
    captureGroupMeApiError("Failed to create bot post.", {
      endpoint: "/v3/bots/post",
      method: "POST",
      status: response.status,
      statusText: response.statusText,
      botId
    })
    throw new Error("Failed to create bot post.")
  }
}

export default post
