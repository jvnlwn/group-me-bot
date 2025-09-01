import { VercelRequest, VercelResponse } from "@vercel/node"
import end_poll from "../../../actions/end_poll/action"
import nudge from "../../../actions/nudge/action"
import poll from "../../../actions/poll/action"
import skip from "../../../actions/skip/action"
import post from "../../../bot/post"
import { getReplyAttachment } from "../../../lib/attachment"
import {
  pinMessage,
  pinPollMessage,
  unpinPollMessage
} from "../../../lib/message"
import { getGroupAndBotId } from "../../../lib/schema"
import { BotCallbackData } from "../../../types"

const actions = { nudge, poll, end_poll, skip }

// The callback URL which GroupMe will call when a user sends a message to the chat
// which the bot is in.
export default async function handler(
  req: VercelRequest & { body: BotCallbackData },
  res: VercelResponse
) {
  const data = req.body
  const { botId, groupId } = getGroupAndBotId(data.group_id)

  // NOTE: data.sender_id !== botId is not an accurate comparison since
  // the two (it seems) will never be the same. The botId is the ID given
  // when the bot is created and can be used in APIs to create posts and such
  // while the data.sender_id (when data.sender_type === "bot") is the user ID
  // of the bot.

  try {
    if (data.sender_type === "bot") {
      // Handle bot messages here.

      // Automatically pin the "skip" message. We'll unpin when the next
      // attempt to poll occurs (when the bot will send a reminder message
      // about the poll being skipped).
      if (data.text === "The next poll will be skipped.") {
        await pinMessage({
          groupId,
          messageId: data.id
        })
      }
    } else if (data.text.startsWith("/")) {
      // Attempt to call a related action based on the command.
      // The command is the text of the message, which starts with a "/".

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
    } else {
      // TODO: refactor this approach. Maybe add a function that accepts
      // callbacks like "onPollCreated" and "onPollEnded" to handle the
      // pinning and unpinning of messages.
      await pinPollMessage(data)
      await unpinPollMessage(data)
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
