import { GroupMeAttachment, GroupMeUser } from "../types"

type GetAtMentionAttachmentsOptions = {
  users: GroupMeUser[]
  text: string
}

export function getAtMentionsAttachment({
  users,
  text
}: GetAtMentionAttachmentsOptions): GroupMeAttachment & { type: "mentions" } {
  const attachment = users.reduce<GroupMeAttachment & { type: "mentions" }>(
    (acc, user) => {
      const { user_id, nickname } = user
      const atMention = `@${nickname}`
      const startIndex = text.indexOf(atMention)
      const endIndex = startIndex + atMention.length
      acc.loci.push([startIndex, endIndex])
      acc.user_ids.push(user_id)
      return acc
    },
    {
      type: "mentions",
      loci: [],
      user_ids: []
    }
  )

  return attachment
}

export function getReplyAttachment(
  id: string
): GroupMeAttachment & { type: "reply" } {
  return {
    type: "reply",
    reply_id: id,
    base_reply_id: id
  }
}
