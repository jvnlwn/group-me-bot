import { VercelRequest, VercelResponse } from "@vercel/node"
import createPoll from "../utils/create_poll"

type BotCallbackData = {
  attachments: any[]
  avatar_url: string
  created_at: number
  group_id: string
  id: string
  name: string
  sender_id: string
  sender_type: string
  source_guid: string
  system: boolean
  text: string
  user_id: string
}

// The callback URL which GroupMe will call when a user sends a message to the chat
// which the bot is in.
export default async function handler(
  req: VercelRequest & { body: BotCallbackData },
  res: VercelResponse
) {
  const data = req.body

  if (data.text === "/create_poll") {
    await createPoll({ groupId: data.group_id })
    res.status(200).json(data)
  } else {
    res.status(200).json({ message: "No action taken" })
  }
}
