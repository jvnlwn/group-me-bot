import { z } from "zod"

// Use this regex to find all group me group ID env vars.
const groupMeGroupIdKeyRe = /GROUP_ME_(?<groupName>.+)_GROUP_ID/
const groupMeGroupIdKeys = Object.keys(process.env).filter((key) =>
  groupMeGroupIdKeyRe.test(key)
)

// Reduce all group me group ID env vars to a map of group IDs to bot IDs.
const botIdMap = groupMeGroupIdKeys.reduce((acc, key) => {
  const groupName = key.match(groupMeGroupIdKeyRe)?.groups?.groupName
  if (groupName) {
    const groupIdKey = `GROUP_ME_${groupName}_GROUP_ID`
    const groupId = process.env[groupIdKey] as string
    const botIdKey = `GROUP_ME_${groupName}_BOT_ID`
    const botId = process.env[botIdKey] as string
    acc[groupId] = z.literal(botId)
  }

  return acc
}, {} as Record<string, z.ZodLiteral<string>>)

export const BotIdMapSchema = z.object(botIdMap)

export const GroupIdSchema = BotIdMapSchema.keyof()

// NOTE: accepting string[] as this is a possible type of req.query.group_id.
export function getGroupAndBotId(groupId: string | string[]) {
  const parsedGroupId = GroupIdSchema.parse(groupId)
  const literalBotId = BotIdMapSchema.shape[parsedGroupId]._def.value!
  return {
    groupId: parsedGroupId,
    botId: literalBotId
  }
}
