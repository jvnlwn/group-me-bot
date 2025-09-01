import post from "../../bot/post"
import { getReplyAttachment } from "../../lib/attachment"
import { getActivePoll, getPolls } from "../../lib/poll"
import { ActionFn, GroupMeAttachment } from "../../types"

// Util for skipping the next poll. This allows for keeping any schedule
// running for automatically creating polls (not needing to alter the schedule,
// or temporarily disable the schedule).
// Executing skip will do the following:
// 1. Respond to the /skip message with an acknowledgement, stating the next poll will be skipped.
// 2. When the next poll is attempted, it will be automatically skipped without any further action required.
export async function skip({
  botId,
  groupId: groupId,
  messageId
}: {
  botId: string
  groupId: string
  messageId?: string
}) {
  const activePoll = await getActivePoll({ polls: await getPolls({ groupId }) })

  if (activePoll) {
    throw new Error("An active poll already exists.")
  }

  const text = "The next poll will be skipped."

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
  return skip({
    botId,
    groupId,
    messageId: id
  })
}

export default action
