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

  // Build result text, this line totaling each option with the offset applied.
  const resultText = poll.options
    .map((option) => `${getOptionOffset(option)} ${option.title}`)
    .join(", ")

  // Append offset information if applicable.
  const offsetText =
    offset !== 0 ? `\n(Offset: ${offset >= 0 ? "+" : "-"}${offset})` : ""

  return resultText + offsetText
}

export function getOffsetAmount(text: string) {
  const offsetRes = [
    // /offset with optional operand
    /^\/offset\b\s*(?<offsetOperand>\+|\-)?\s*((?<offsetValue>\d+)|(?<offsetString>.+))/,
    // /(-|+), requiring the operand
    /^\/(?<offsetOperand>\+|\-)\s*((?<offsetValue>\d+)|(?<offsetString>.+))/
  ]

  const match = offsetRes.reduce(
    (match, re) => {
      return match || text.match(re)
    },
    null as RegExpMatchArray | null
  )

  if (match?.groups) {
    const { offsetOperand, offsetValue, offsetString } = match.groups
    let offsetAmount = 0

    // We handle the literal offset value or the more flexible offset string.
    if (offsetValue) {
      offsetAmount = parseInt(offsetValue, 10)
    } else if (offsetString) {
      // Count name entries rather than their last words, so punctuation and
      // Unicode names work and "and" inside a name is not a separator.
      offsetAmount = offsetString
        .split(/,|&|\band\b/i)
        .filter((name) => /[\p{L}\p{N}]/u.test(name)).length
    }

    // Apply the offset operand.
    return offsetOperand === "-" && offsetAmount > 0
      ? -offsetAmount
      : offsetAmount
  }

  return 0
}

async function getPollOffset(poll: GroupMePoll) {
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
    const text = message.text || ""
    return (acc += getOffsetAmount(text))
  }, 0)

  return totalOffset
}

// Check for current poll results. Mainly just a workaround for a bug in Group Me where
// poll results can be stale in the app.
export async function getCurrentPollResultsText({
  groupId,
  polls
}: {
  groupId: string
  polls?: GroupMePoll[]
}) {
  const activePoll = await getActivePoll({
    groupId,
    polls: polls ?? (await getPolls({ groupId })).polls
  })

  if (!activePoll) {
    throw new Error("No active poll found.")
  }

  return `Current Poll Results: ${await getPollResultsText(activePoll)}`
}

export async function check({
  botId,
  groupId,
  messageId
}: {
  botId: string
  groupId: string
  messageId?: string
}) {
  const text = await getCurrentPollResultsText({ groupId })

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
