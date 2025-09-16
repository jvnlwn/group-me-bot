import { DateTime } from "luxon"
import post from "../../bot/post"
import { getReplyAttachment } from "../../lib/attachment"
import { getPinnedMessages, unpinMessage } from "../../lib/message"
import { getActivePoll, getPolls } from "../../lib/poll"
import { ActionFn } from "../../types"

// Util for creating a poll in a groupme group.
// The poll is hardcoded to ask if people are coming tomorrow for soccer,
// so, very specific use case.
export async function createPoll({
  botId,
  groupId,
  date,
  title,
  retry
}: {
  botId: string
  groupId: string
  date: number
  title?: string
  retry?: boolean
}) {
  const token = process.env.GROUP_ME_API_ACCESS_TOKEN

  const activePoll = await getActivePoll({ polls: await getPolls({ groupId }) })

  if (activePoll) {
    throw new Error("An active poll already exists.")
  }

  // Now check for if the next poll should be skipped.
  // We'll query for a bot message where the attachment contains
  // the "skip" keyword.
  const { messages: pinnedMessages } = await getPinnedMessages({
    groupId
  })
  // Find the pinned message with the poll.created event type.
  const pinnedSkipMessage = pinnedMessages.find((message) => {
    return (
      message.sender_type === "bot" &&
      message.text === "The next poll will be skipped."
    )
  })

  if (pinnedSkipMessage) {
    await post({
      botId,
      text: "Reminder: skipping today's poll.",
      attachments: [getReplyAttachment(pinnedSkipMessage.id)]
    })

    await unpinMessage({
      groupId,
      messageId: pinnedSkipMessage.id
    })
    return
  }

  // Find the pinned message with the poll.created event type.
  const pinnedRetryMessage = pinnedMessages.find((message) => {
    return (
      message.sender_type === "bot" &&
      message.text === "The poll will be retried."
    )
  })

  if (pinnedRetryMessage) {
    if (retry) {
      await post({
        botId,
        text: "Reminder: retrying the previous poll.",
        attachments: [getReplyAttachment(pinnedRetryMessage.id)]
      })
    }

    await unpinMessage({
      groupId,
      messageId: pinnedRetryMessage.id
    })

    if (!retry) {
      return
    }
  } else if (retry) {
    // No poll to retry.
    return
  }

  // Set the expiration relative to the created date.
  const epxirationUTCDate = new Date(date * 1000)

  // Create a date expiring at 9pm ET. You may have to define timezone for
  // each group if you don't want to hardcode this.
  const epxirationETDateTime = DateTime.fromObject(
    {
      year: epxirationUTCDate.getFullYear(),
      month: epxirationUTCDate.getMonth() + 1,
      day: epxirationUTCDate.getDate(),
      hour: 21,
      minute: 0
    },
    { zone: "America/New_York" }
  )

  // Now convert to UTC JS Date.
  const expirationUTCTime =
    epxirationETDateTime.toUTC().toJSDate().getTime() / 1000

  const response = await fetch(
    `https://api.groupme.com/v3/poll/${groupId}?token=${token}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        subject: title ? `⚽ ${title}` : "⚽",
        options: [{ title: "Yes" }, { title: "No" }],
        expiration: expirationUTCTime,
        visibility: "public",
        type: "single"
      })
    }
  )

  if (!response.ok) {
    throw new Error("Failed to create poll.")
  }

  const data = await response.json()
  return data
}

const action: ActionFn = async ({
  botId,
  group_id: groupId,
  created_at,
  text
}) => {
  const titleRe = /\/poll *(?<title>.+)/
  const title = text.match(titleRe)?.groups?.title || ""

  return createPoll({
    botId,
    groupId,
    title,
    date: created_at
  })
}

export default action
