import { VercelRequest, VercelResponse } from "@vercel/node"
import end_poll from "../../../actions/end_poll/action"
import nudge from "../../../actions/nudge/action"
import poll from "../../../actions/poll/action"
import post from "../../../bot/post"
import { getReplyAttachment } from "../../../lib/attachment"
import { getGroupAndBotId } from "../../../lib/schema"
import { BotCallbackData } from "../../../types"

const actions = { nudge, poll, end_poll }

// The callback URL which GroupMe will call when a user sends a message to the chat
// which the bot is in.
export default async function handler(
  req: VercelRequest & { body: BotCallbackData },
  res: VercelResponse
) {
  const data = req.body
  const { botId } = getGroupAndBotId(data.group_id)

  try {
    // Attempt to call a related action based on the command.
    // The command is the text of the message, which starts with a "/".
    if (data.sender_id !== botId && data.text.startsWith("/")) {
      // NOTE: attempted dynamic import of action but deployed
      // function couldn't find the module.
      // Probably an issue on my end.
      // const action = (await import(`../actions${data.text}/action`)).default

      const actionRe = /\/(?<action>\w+)/
      const actionKey = data.text.match(actionRe)?.groups
        ?.action as keyof typeof actions
      const action = actions[actionKey]
      if (action) {
        await action({ botId, ...data })
      } else {
        // List supported actions.
        const actionsList = Object.keys(actions)
          .map((key) => `/${key}`)
          .join(", ")
        const message = `No action taken.\nAvailable actions are: ${actionsList}`
        // If we cannot find the action, let the user know.
        await post({
          botId: botId,
          text: message,
          attachments: [getReplyAttachment(data.id)]
        })
        res.status(200).json({
          message
        })
        return
      }
    }
  } catch (error) {
    await post({
      botId,
      text: `Error: ${(error as Error).message}`,
      attachments: [getReplyAttachment(data.id)]
    })
  }

  res.status(200).json({ message: "Success" })
  return
}
