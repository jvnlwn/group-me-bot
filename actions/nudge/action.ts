import { readFileSync } from "fs"
import OpenAI from "openai"
import { join } from "path"
import post from "../../bot/post"
import {
  getAtMentionsAttachment,
  getReplyAttachment
} from "../../lib/attachment"
import {
  computeWeightedYesLikelihood,
  getMemberVote,
  getNonPolledUsers
} from "../../lib/poll"
import { ActionFn, GroupMeUser } from "../../types"

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

export async function nudge({
  botId,
  groupId,
  count,
  messageId
}: {
  botId: string
  groupId: string
  count: number
  messageId?: string
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
  const nonPolledUsers = await getNonPolledUsers({
    groupId
  })
  const memberVoteMap = await getMemberVote({ groupId })
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

  if (users.length === 0) {
    throw new Error("No players to nudge.")
  }

  const nicknames = users.map((user) => user.nickname)
  const mdPath = join(__dirname, "instructions.md")
  const instructions = readFileSync(mdPath, "utf-8")
  const atMentions = nicknames.map((nickname) => `@${nickname}`).join(", ")
  const input = `Nudge: ${atMentions}`

  const response = await client.responses.create({
    // model: "gpt-4o-mini",
    model: "gpt-4o",
    instructions,
    input,
    top_p: 0.5
  })

  const attachments = [
    getAtMentionsAttachment({
      users: users,
      text: atMentions
    })
  ]

  if (messageId) {
    getReplyAttachment(messageId)
  }

  await post({
    botId,
    text: response.output_text,
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
  const countRe = /\/nudge +(?<count>\d+)/
  const matchCount = text.match(countRe)?.groups?.count || "1"
  const count = matchCount ? parseInt(matchCount) : 0

  await nudge({
    botId,
    groupId,
    count,
    messageId: id
  })
}

export default action
