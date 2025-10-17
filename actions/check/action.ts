import post from "../../bot/post"
import { getReplyAttachment } from "../../lib/attachment"
import { getActivePoll, getPolls } from "../../lib/poll"
import { ActionFn, GroupMeAttachment, GroupMePoll } from "../../types"

export function getPollResultsText(poll: GroupMePoll) {
  return poll.options
    .map((option) => `${option.votes || 0} ${option.title}`)
    .join(", ")
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

  const text = `Current Poll Results: ${getPollResultsText(activePoll)}`

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
