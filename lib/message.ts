import { BotCallbackData, GroupMeMessage, GroupMePinnedMessage } from "../types"
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

export function isPollCreatedMessage({ text }: { text: string | null }) {
  const re = new RegExp(`^created new poll '(${pollTitles.join("|")}).*'$`, "i")
  return !!text && re.test(text)
}

export function isPollExpiredMessage({ text }: { text: string | null }) {
  const re = new RegExp(`^poll '(${pollTitles.join("|")}).*' has expired$`, "i")
  return !!text && re.test(text)
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

export async function getMessages({
  groupId,
  limit,
  ...args
}: {
  groupId: string
  // 20 is the default, max of 100.
  limit?: number
} & ( // If before_id is provided, then messages immediately preceding the given message will be returned, in descending order. This can be used to continually page back through a group's messages.
  | { beforeId?: string }
  // The after_id parameter will return messages that immediately follow a given message, this time in ascending order (which makes it easy to pick off the last result for continued pagination).
  | { afterId?: string }
  // Finally, the since_id parameter also returns messages created after the given message, but it retrieves the most recent messages. For example, if more than twenty messages are created after the since_id message, using this parameter will omit the messages that immediately follow the given message. This is a bit counterintuitive, so take care.
  | { sinceId?: string }
)) {
  const url = new URL(`https://api.groupme.com/v3/groups/${groupId}/messages`)
  url.searchParams.append("token", token || "")
  url.searchParams.append("limit", limit?.toString() || "20")

  if ("beforeId" in args && args.beforeId) {
    url.searchParams.append("before_id", args.beforeId)
  }

  if ("afterId" in args && args.afterId) {
    url.searchParams.append("after_id", args.afterId)
  }

  if ("sinceId" in args && args.sinceId) {
    url.searchParams.append("since_id", args.sinceId)
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  })

  if (!response.ok) {
    throw new Error("Failed to get messages.")
  }

  const { response: data } = (await response.json()) as {
    response: { messages: GroupMeMessage[]; count: number }
  }

  return data.messages
}
