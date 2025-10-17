import { BotCallbackData, GroupMePinnedMessage } from "../types"
import { pollTitles } from "./poll"

const token = process.env.GROUP_ME_API_ACCESS_TOKEN

export async function getPinnedMessages({
  groupId
}: {
  groupId: string | number
}) {
  const response = await fetch(
    `https://api.groupme.com/v3/pinned/groups/${groupId}/messages?token=${token}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    }
  )

  if (!response.ok) {
    throw new Error("Failed to list pinned messages.")
  }

  const { response: data } = (await response.json()) as {
    response: { messages: GroupMePinnedMessage[]; count: number }
  }

  return data
}

export async function pinMessage({
  groupId,
  messageId
}: {
  groupId: string | number
  messageId: string
}) {
  const response = await fetch(
    `https://api.groupme.com/v3/conversations/${groupId}/messages/${messageId}/pin?token=${token}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    }
  )

  if (!response.ok) {
    throw new Error("Failed to pin message.")
  }
}

export async function unpinMessage({
  groupId,
  messageId
}: {
  groupId: string | number
  messageId: string
}) {
  const response = await fetch(
    `https://api.groupme.com/v3/conversations/${groupId}/messages/${messageId}/unpin?token=${token}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    }
  )

  if (!response.ok) {
    throw new Error("Failed to unpin message.")
  }
}

export function isPollCreatedMessage({ text }: BotCallbackData) {
  const re = new RegExp(`^created new poll '(${pollTitles.join("|")}).*'$`, "i")
  return re.test(text)
}

export function isPollExpiredMessage({ text }: BotCallbackData) {
  const re = new RegExp(`^poll '(${pollTitles.join("|")}).*' has expired$`, "i")
  return re.test(text)
}

// Pin "created poll" message.
// Note that the BotCallbackData will contain no event type so
// it must be inferred from the text string.
export async function pinPollMessage({
  id,
  group_id,
  attachments
}: BotCallbackData) {
  const pollId = attachments?.[0]?.poll_id
  if (pollId) {
    await pinMessage({
      groupId: group_id,
      messageId: id
    })
  }
}

// Unpin "created poll" message.
// Note that the BotCallbackData will contain no reference to the poll.
export async function unpinPollMessage({ group_id }: BotCallbackData) {
  const { messages: pinnedMessages } = await getPinnedMessages({
    groupId: group_id
  })
  // Find the pinned message with the poll.created event type.
  const pinnedMessage = pinnedMessages.find((message) => {
    return message.event?.type === "poll.created"
  })

  if (pinnedMessage) {
    await unpinMessage({
      groupId: group_id,
      messageId: pinnedMessage.id
    })
  }
}
