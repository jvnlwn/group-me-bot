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
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" })
    return
  }

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
    // Ignore sending certain errors as bot messages.
    const ignoredErrors = ["No players to nudge.", "No active poll found."]

    const message = (error as Error).message

    // Only send an error message if it's not "No players to nudge"
    if (!ignoredErrors.includes(message)) {
      await post({
        botId,
        text: `Error: ${message}`
      })
    } else {
      res.status(200).json({ message })
    }
  }

  res.status(200).json({ message: "Success" })
  return
}
