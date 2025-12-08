import post from "../../bot/post"
import { getReplyAttachment } from "../../lib/attachment"
import { getMessages, isPollCreatedMessage } from "../../lib/message"
import { getActivePoll, getPolls } from "../../lib/poll"
import {
  ActionFn,
  GroupMeAttachment,
  GroupMePoll,
  GroupMePollOption
} from "../../types"

export async function getPollResultsText(poll: GroupMePoll) {
  const offset = await getPollOffset(poll)

  function getOptionOffset(option: GroupMePollOption) {
    const pollVotes = option.votes || 0

    // Calculate the offset for this option based on the total offset.
    if (option.title.toLowerCase() === "yes") {
      return pollVotes + offset
    }
    return pollVotes
  }

  return poll.options
    .map((option) => `${getOptionOffset(option)} ${option.title}`)
    .join(", ")
}

async function getPollOffset(poll: GroupMePoll) {
  const titleRe = /^\/offset *(?<offsetOperand>\+|\-)?(?<offsetValue>\d+)/

  const messages = await getMessages({
    groupId: poll.conversation_id,
    limit: 100
    // NOTE: ideally we'd have a message ID to fetch messages after, but the poll
    // doesn't contain this data (the conversation_id revers to the group ID).
    // afterId: poll.conversation_id
  })

  // So, instead we'll perform our own filtering be getting all messages coming after
  // the latest "created poll" message.
  const createdPollIndex = messages.findIndex((message) =>
    isPollCreatedMessage(message)
  )

  const relevantMessages =
    createdPollIndex >= 0 ? messages.slice(0, createdPollIndex) : messages

  // Reduce messages to get total offset amount.
  const totalOffset = relevantMessages.reduce<number>((acc, message) => {
    const { text } = message
    const match = text.match(titleRe)
    if (match?.groups) {
      const { offsetOperand, offsetValue } = match.groups
      const offsetAmount =
        parseInt(offsetValue, 10) * (offsetOperand === "-" ? -1 : 1)
      acc += offsetAmount
    }
    return acc
  }, 0)

  return totalOffset
}

// Check for current poll results. Mainly just a workaround for a bug in Group Me where
// poll results can be stale in the app.
export async function check({
  botId,
  groupId,
  messageId
}: {
  botId: string
  groupId: string
  messageId?: string
}) {
  const activePoll = await getActivePoll({ polls: await getPolls({ groupId }) })

  if (!activePoll) {
    throw new Error("No active poll found.")
  }

  const text = `Current Poll Results: ${await getPollResultsText(activePoll)}`

  const attachments: GroupMeAttachment[] = []

  if (messageId) {
    attachments.push(getReplyAttachment(messageId))
  }

  await post({
    botId,
    text,
    attachments
  })
}

const action: ActionFn = async ({ botId, group_id: groupId, id }) => {
  return check({
    botId,
    groupId,
    messageId: id
  })
}

export default action
