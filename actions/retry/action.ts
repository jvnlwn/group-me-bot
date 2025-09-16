import post from "../../bot/post"
import { getReplyAttachment } from "../../lib/attachment"
import { getActivePoll, getPolls } from "../../lib/poll"
import { ActionFn, GroupMeAttachment } from "../../types"

// Util for retrying failed poll. The schedule should optionally poll
// when detecting a previously failed poll should be retried.
// Executing retry will do the following:
// 1. Respond to the /retry message with an acknowledgement, stating the previous poll will be retried.
// 2. When the next retry poll is scheduled, it will be automatically create a poll without any further action required.
export async function retry({
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

  const text = "The poll will be retried."

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
  return retry({
    botId,
    groupId,
    messageId: id
  })
}

export default action
