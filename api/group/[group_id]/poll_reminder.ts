import { VercelRequest, VercelResponse } from "@vercel/node"
import { nudge } from "../../../actions/nudge/action"
import post from "../../../bot/post"
import { getGroupAndBotId } from "../../../lib/schema"
import { BotCallbackData } from "../../../types"

// The callback URL which GroupMe will call when a user sends a message to the chat
// which the bot is in.
export default async function handler(
  req: VercelRequest & { body: BotCallbackData },
  res: VercelResponse
) {
  // The req.query.group_id could be a string or an array of strings.
  // We need to cast it to a string to use it as a key in the botIdMap.
  const { groupId, botId } = getGroupAndBotId(req.query.group_id)

  try {
    await nudge({
      botId,
      groupId: groupId,
      count: Infinity
    })
  } catch (error) {
    // TODO: we don't really want to send the "No players to nudge" error.
    await post({
      botId,
      text: `Error: ${(error as Error).message}`
    })
  }

  res.status(200).json({ message: "Success" })
  return
}
