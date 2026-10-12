import * as Sentry from "@sentry/node"
import microdiff from "microdiff"
import { GroupMeGroup, GroupMePoll, GroupMeUser } from "../types"
import { getGroup } from "./group"
import { captureGroupMeApiError } from "./sentry"

// There are currently two disctinct soccer emojis used in
// soccer poll subjects. There may be no visiual difference,
// but they are not equivalent strings.
export const pollTitles = ["⚽️", "⚽"]

const token = process.env.GROUP_ME_API_ACCESS_TOKEN

export async function getPoll({
  groupId,
  pollId
}: {
  groupId: string | number
  pollId: string
}): Promise<GroupMePoll> {
  let url = `https://api.groupme.com/v3/poll/${groupId}/${pollId}?token=${token}`

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  })

  if (!response.ok) {
    captureGroupMeApiError("Failed to get poll.", {
      endpoint: "/v3/poll/:groupId/:pollId",
      method: "GET",
      status: response.status,
      statusText: response.statusText,
      groupId: String(groupId),
      pollId: String(pollId)
    })

    throw new Error("Failed to get poll.")
  }

  const { response: data } = (await response.json()) as {
    response: {
      // For some reason querying the poll directly has user_votes as sibling of poll, not in poll.
      poll: { data: Omit<GroupMePoll, "user_votes">; user_votes?: string[] }
    }
  }

  return {
    ...data.poll.data,
    user_votes: data.poll.user_votes ?? []
  }
}

export async function getPolls({
  groupId,
  continuationToken
}: {
  groupId: string | number
  continuationToken?: string
}) {
  // Polls paginate by 10 by default and no documentation specifies increases this limit.
  let url = `https://api.groupme.com/v3/poll/${groupId}?token=${token}&per_page=100`

  if (continuationToken) {
    url += `&continuation_token=${continuationToken}`
  }

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    }
  })

  if (!response.ok) {
    captureGroupMeApiError("Failed to list polls.", {
      endpoint: "/v3/poll/:groupId",
      method: "GET",
      status: response.status,
      statusText: response.statusText,
      groupId: String(groupId)
    })

    throw new Error("Failed to list polls.")
  }

  const { response: data } = (await response.json()) as {
    response: {
      polls: { data: GroupMePoll; user_votes: string[] }[]
      continuation_token: string | null
    }
  }

  return {
    polls: data.polls.map((poll) => poll.data),
    continuationToken: data.continuation_token
  }
}

export async function getAllPolls({
  groupId,
  fromDate
}: {
  groupId: string | number
  fromDate?: Date
}) {
  const polls: GroupMePoll[] = []
  let continuationToken: string | undefined
  // A necessary hack to avoid infinite loops, since somehow the continuation tokens cycle, as if we paginate through a loop.
  // So, if we've seen the same continuation token twice, we can stop.
  let initialContinuationToken: string | undefined

  do {
    const result = await getPolls({
      groupId,
      continuationToken
    })

    let pollsToAdd = result.polls
    // If a fromDate is provided, filter out polls before that date.
    // Stop pagination early if we've reached the fromDate.
    if (fromDate) {
      pollsToAdd = pollsToAdd.filter(
        (poll) => new Date(poll.created_at * 1000) > fromDate
      )
    }

    polls.push(...pollsToAdd)

    const reachedFromDate = result.polls.length !== pollsToAdd.length
    if (reachedFromDate) break

    // NOTE: pagination appears to be broken in that the second page comes back with
    // the same continuation token as the first page. We know this is happening at some point
    // hence the check below, but on the second page is earliar than previously observed.
    const nextContinuationToken = result.continuationToken ?? undefined
    continuationToken =
      nextContinuationToken === initialContinuationToken
        ? undefined
        : nextContinuationToken
    initialContinuationToken ??= nextContinuationToken
  } while (continuationToken)

  return polls
}

export function getPollIsSoccer(poll: GroupMePoll) {
  return pollTitles.includes(poll.subject?.[0])
}

export async function getActivePoll({
  groupId,
  polls
}: {
  groupId: string | number
  polls: GroupMePoll[]
}) {
  const activePoll = polls.find(
    (poll) => poll.status === "active" && getPollIsSoccer(poll)
  )

  if (!activePoll) return

  const poll = await getPoll({ groupId, pollId: activePoll.id })

  const diff = microdiff(activePoll.options, poll.options)

  if (diff.length) {
    Sentry.withScope((scope) => {
      scope.setTag("diff", JSON.stringify(diff))
      Sentry.captureException("Same poll in Polls list and Poll differ.")
    })
  }

  return poll
}

// Get's most recenty expired poll.
export function getExpiredPoll({ polls }: { polls: GroupMePoll[] }) {
  const expiredPoll = polls
    .filter((poll) => poll.status === "past" && getPollIsSoccer(poll))
    .sort((a, b) => {
      return b.expiration - a.expiration
    })[0]

  return expiredPoll
}

// Util for getting a list of users who have not yet responded to a poll in a groupme group.
// Accepts optional preloaded group/polls to avoid redundant fetches when composing with other utils.
export async function getNonPolledUsers({
  groupId,
  group: groupOpt,
  polls: pollsOpt
}: {
  groupId: string | number
  group?: GroupMeGroup
  polls?: GroupMePoll[]
}) {
  const [polls, group] =
    pollsOpt !== undefined && groupOpt !== undefined
      ? [pollsOpt, groupOpt]
      : await Promise.all([
          pollsOpt ?? (await getPolls({ groupId })).polls,
          groupOpt ?? getGroup({ groupId })
        ])

  const activePoll = await getActivePoll({ groupId, polls })
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

// Accepts optional preloaded polls/nonPolledUsers to avoid redundant fetches when composing with other utils.
export async function getMemberVote({
  groupId,
  polls: pollsOpt,
  nonPolledUsers: nonPolledUsersOpt
}: {
  groupId: string | number
  polls?: GroupMePoll[]
  nonPolledUsers?: GroupMeUser[]
}): Promise<MemberVoteMap> {
  let polls = pollsOpt
  let nonPolledUsers = nonPolledUsersOpt

  if (nonPolledUsers === undefined) {
    const [p, g] = await Promise.all([
      polls ?? (await getPolls({ groupId })).polls,
      getGroup({ groupId })
    ])
    polls = p
    nonPolledUsers = await getNonPolledUsers({ groupId, group: g, polls })
  } else if (polls === undefined) {
    polls = (await getPolls({ groupId })).polls
  }

  // Only taking a sample, that of the last 12 expired polls.
  // The more recent the data, the more relevant it is.
  const latestExpiredPolls = polls
    .filter((poll) => poll.status !== "active" && getPollIsSoccer(poll))
    .slice(0, 12)

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
