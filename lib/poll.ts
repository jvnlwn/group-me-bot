import { GroupMePoll } from "../types"
import { getGroup } from "./group"

// There are currently two disctinct soccer emojis used in
// soccer poll subjects. There may be no visiual difference,
// but they are not equivalent strings.
export const pollTitles = ["⚽️", "⚽"]

const token = process.env.GROUP_ME_API_ACCESS_TOKEN

export async function getPolls({ groupId }: { groupId: string | number }) {
  const response = await fetch(
    `https://api.groupme.com/v3/poll/${groupId}?token=${token}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    }
  )

  if (!response.ok) {
    throw new Error("Failed to list polls.")
  }

  const { response: data } = (await response.json()) as {
    response: { polls: { data: GroupMePoll }[] }
  }

  return data.polls.map((poll) => poll.data)
}

export function getActivePoll({ polls }: { polls: GroupMePoll[] }) {
  const activePoll = polls.find(
    (poll) => poll.status === "active" && pollTitles.includes(poll.subject?.[0])
  )

  return activePoll
}

// Get's most recenty expired poll.
export function getExpiredPoll({ polls }: { polls: GroupMePoll[] }) {
  const expiredPoll = polls
    .filter(
      (poll) => poll.status === "past" && pollTitles.includes(poll.subject?.[0])
    )
    .sort((a, b) => {
      return b.expiration - a.expiration
    })[0]

  return expiredPoll
}

// Util for getting a list of users who have not yet responded to a poll in a groupme group.
export async function getNonPolledUsers({
  groupId
}: {
  groupId: string | number
}) {
  const [activePoll, group] = await Promise.all([
    getActivePoll({ polls: await getPolls({ groupId }) }),
    getGroup({ groupId })
  ])

  if (!activePoll) {
    throw new Error("No active poll found.")
  }

  const polledUserIds = activePoll.options.reduce<string[]>((acc, option) => {
    if (option.voter_ids) acc.push(...option.voter_ids)
    return acc
  }, [])

  const nonPolledUsers = group.members.filter((user) => {
    return !polledUserIds.includes(user.user_id) && !user.muted
  })

  return nonPolledUsers
}

type MemberVoteMap = Record<
  string,
  (
    | -1 // "no" vote
    | 0 // "no vote"
    | 1
  )[] // "yes" vote
>

export async function getMemberVote({
  groupId
}: {
  groupId: string | number
}): Promise<MemberVoteMap> {
  //

  const [polls, group] = await Promise.all([
    getPolls({ groupId }),
    getGroup({ groupId })
  ])
  const activePoll = polls.find(
    (poll) => poll.status === "active" && pollTitles.includes(poll.subject?.[0])
  )
  // Only taking a sample, that of the last 12 expired polls.
  // The more recent the data, the more relevant it is.
  const latestExpiredPolls = polls
    .filter(
      (poll) =>
        poll.status !== "active" && pollTitles.includes(poll.subject?.[0])
    )
    .slice(0, 12)

  // TODO: don't run an extra query...
  // Only calculate for non-polled users.
  // We should probably instead get a separate member vote map for the active poll,
  // then use that to filter out the polled users from the expired polls.
  // This is because we only care about the likelihood of the non-polled users
  // voting in the active poll.
  const nonPolledUsers = await getNonPolledUsers({ groupId })

  // Create a map of members to their votes in the last 12 expired polls.
  const memberVoteMap = latestExpiredPolls.reduce<MemberVoteMap>(
    (acc, poll, i) => {
      // Default vote for each member to a "0" (no vote),
      // not to be confused with a "no" vote.
      nonPolledUsers.forEach((member) => {
        acc[member.user_id] ??= []
        acc[member.user_id].push(0)
      })

      // For each member vote, change the "no vote" to a "1" (yes) or "-1" (no).
      poll.options.forEach((option) => {
        option.voter_ids?.forEach((voterId) => {
          // The voter may no longer be a member of the group, in which case
          // we don't need to account for their vote.
          if (acc[voterId])
            acc[voterId][i] = option.title.toLowerCase() === "yes" ? 1 : -1
        })
      })

      return acc
    },
    {}
  )

  return memberVoteMap
}

export async function calculatePollProbability({
  groupId
}: {
  groupId: string | number
}) {
  const memberVoteMap = await getMemberVote({ groupId })
  const weightedYesLikelihood = computeWeightedYesLikelihood(memberVoteMap)
  const probabilities = computeYesVoteProbabilities(weightedYesLikelihood)

  // TODO: apply a bias correction or calibration technique where we get the
  // average "yes" vote for the last 12 polls and calculate the difference
  // of that number's probability and 50% which we then apply to the whole
  // probability distribution. This will help us avoid the "yes" vote
  // being too high or too low. We can also use the confidence of the
  // "yes" vote to adjust the bias correction?
  // Example would be: if the average "yes" vote count is 8, and the probability
  // of an 8 "yes" vote is .2, then we can apply a bias correction of .3 to the
  // whole probability distribution. This will hopefullly produce more accurate
  // probabilities, as they seem to be on the low side overall.

  return {
    memberVoteMap,
    weightedYesLikelihood,
    probabilities
  }
}

type WeightedYesLikelihood = Record<
  string,
  { likelihood: number; confidence: number }
>

// Decay function (can be tweaked)
const DECAY_BASE = 0.75

// Oh, thank you ChatGPT for this function.
export function computeWeightedYesLikelihood(voteMap: MemberVoteMap) {
  const result: WeightedYesLikelihood = {}

  for (const [userId, votes] of Object.entries(voteMap)) {
    let weightedSum = 0
    let totalWeight = 0

    let confidenceSum = 0
    let maxConfidenceSum = 0

    for (let i = 0; i < votes.length; i++) {
      const vote = votes[i]
      const weight = Math.pow(DECAY_BASE, i)

      // Only actual yes/no votes count toward likelihood
      if (vote === 1) weightedSum += weight
      else if (vote === -1) weightedSum += 0

      if (vote !== 0) confidenceSum += weight
      maxConfidenceSum += weight

      if (vote !== 0) totalWeight += weight
    }

    const likelihood = totalWeight === 0 ? 0.5 : weightedSum / totalWeight
    const confidence =
      maxConfidenceSum === 0 ? 0 : confidenceSum / maxConfidenceSum

    result[userId] = { likelihood, confidence }
  }

  return result
}

// Oh, thank you ChatGPT for this function.
function computeYesVoteProbabilities(
  weightedMap: WeightedYesLikelihood,
  useConfidence = true
) {
  const entries = Object.entries(weightedMap)

  const sorted = entries.sort(([, a], [, b]) => {
    const scoreA = useConfidence ? a.likelihood * a.confidence : a.likelihood
    const scoreB = useConfidence ? b.likelihood * b.confidence : b.likelihood
    return scoreB - scoreA
  })

  const probabilities = []
  let cumulative = 1

  for (const [, { likelihood }] of sorted) {
    cumulative *= likelihood
    probabilities.push(+cumulative.toFixed(2))
  }

  return probabilities
}
