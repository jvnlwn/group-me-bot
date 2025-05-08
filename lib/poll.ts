import { GroupMePoll } from "../types"
import { getGroup } from "./group"

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

export async function getActivePoll({ polls }: { polls: GroupMePoll[] }) {
  const activePoll = polls.find(
    (poll) => poll.status === "active" && poll.subject === "⚽"
  )

  return activePoll
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
