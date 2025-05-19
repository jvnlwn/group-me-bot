import { VercelRequest, VercelResponse } from "@vercel/node"
import { getPinnedMessages } from "../../../lib/message"
import { getGroupAndBotId } from "../../../lib/schema"
import { BotCallbackData } from "../../../types"

// Probably only useful for debugging.
export default async function handler(
  req: VercelRequest & { body: BotCallbackData },
  res: VercelResponse
) {
  const { groupId } = getGroupAndBotId(req.query.group_id)
  const data = await getPinnedMessages({ groupId })

  res.status(200).json({ data })
  return
}
