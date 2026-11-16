import post from "../../bot/post"
import { getReplyAttachment } from "../../lib/attachment"
import { getGroup } from "../../lib/group"
import {
  computeWeightedYesLikelihood,
  getMemberVote,
  getNonPolledUsers,
  getPolls
} from "../../lib/poll"
import { captureApiError } from "../../lib/sentry"
import { ActionFn, GroupMeAttachment, GroupMeUser } from "../../types"
import { getCurrentPollResultsText } from "../check/action"
import { createFallbackReminder, createPoeticReminder, PoetryMode } from "./poetry"

export async function nudge({
  botId,
  groupId,
  count,
  messageId,
  mode = Math.random() < 0.5 ? "rhyme" : "haiku",
  includePollResults = false
}: {
  botId: string
  groupId: string
  count: number
  messageId?: string
  mode?: PoetryMode
  includePollResults?: boolean
}) {
  // TODO: filter out already nudged users.
  // This is handled by querying the list of messages occurring since
  // the most recent poll was created, finding all bot messages that
  // include a "reply" attachment linking to a /nudge message and a "mentions"
  // attachment with the user IDs of the players that were nudged.
  // We can then filter out the nonPolledUsers by the list of those user IDs.
  // NOTE: we may need to not filter when the /nudge message itself also includes
  // a "mentions" attachment. We could handle this case differently if we wanted,
  // like to have fun with the user who nudged since the user they are trying to
  // /nudge has already been nudged (AI response?).
  const [group, pollsData] = await Promise.all([
    getGroup({ groupId }),
    getPolls({ groupId })
  ])
  const polls = pollsData.polls
  const nonPolledUsers = await getNonPolledUsers({
    groupId,
    group,
    polls
  })
  const memberVoteMap = await getMemberVote({
    groupId,
    polls,
    nonPolledUsers
  })
  // Get the weighted yes likelihood for each user.
  const weightedYesLikelihood = computeWeightedYesLikelihood(memberVoteMap)
  // Sort the non-polled users by their weighted yes likelihood.
  // TODO: mv to util.
  const sortedNonPolledUsers = nonPolledUsers
    .filter((user) => {
      // Filter out users who have not voted in the last 12 polls.
      return weightedYesLikelihood[user.user_id].confidence > 0
    })
    .sort((a, b) => {
      // Weight the likelihood by the confidence.
      // The higher the confidence, the more likely they are to vote.
      function getProbability(user: GroupMeUser) {
        const likelihood = weightedYesLikelihood[user.user_id].likelihood || 0
        const confidence = weightedYesLikelihood[user.user_id].confidence || 0
        return likelihood * confidence
      }
      return getProbability(b) - getProbability(a)
    })

  const users = sortedNonPolledUsers.slice(0, count)
  const prefix = includePollResults
    ? await getCurrentPollResultsText({ groupId, polls })
    : ""

  if (users.length === 0) {
    if (prefix) {
      await post({ botId, text: prefix })
      return
    }
    throw new Error("No players to nudge.")
  }

  let reminder: Awaited<ReturnType<typeof createPoeticReminder>>
  try {
    reminder = await createPoeticReminder({ users, mode, prefix })
  } catch (error) {
    captureApiError(error, {
      endpoint: "nudge",
      groupId,
      action: "generate_poem"
    })
    reminder = createFallbackReminder(users, prefix)
  }

  const attachments: GroupMeAttachment[] = [reminder.mentions]

  if (messageId) {
    attachments.push(getReplyAttachment(messageId))
  }

  await post({
    botId,
    text: reminder.text,
    attachments
  })
}

const action: ActionFn = async ({ botId, group_id: groupId, id, text }) => {
  // TODO: filter out already nudged users.
  // This is handled by querying the list of messages occurring since
  // the most recent poll was created, finding all bot messages that
  // include a "reply" attachment linking to a /nudge message and a "mentions"
  // attachment with the user IDs of the players that were nudged.
  // We can then filter out the nonPolledUsers by the list of those user IDs.
  // NOTE: we may need to not filter when the /nudge message itself also includes
  // a "mentions" attachment. We could handle this case differently if we wanted,
  // like to have fun with the user who nudged since the user they are trying to
  // /nudge has already been nudged (AI response?).
  const args = text.trim().split(/\s+/).slice(1)
  const count = Number(args.find((arg) => /^\d+$/.test(arg)) ?? "1")
  const mode = args.find(
    (arg): arg is PoetryMode => arg === "rhyme" || arg === "haiku"
  )

  await nudge({
    botId,
    groupId,
    count,
    messageId: id,
    mode
  })
}

export default action
