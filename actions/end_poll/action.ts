import { captureGroupMeApiError } from "../../lib/sentry"
import { getActivePoll, getPolls } from "../../lib/poll"
import { ActionFn } from "../../types"

// Util for ending an active poll in a groupme group.
const action: ActionFn = async ({ group_id: groupId }) => {
  const token = process.env.GROUP_ME_API_ACCESS_TOKEN

  const activePoll = await getActivePoll({ polls: await getPolls({ groupId }) })

  if (!activePoll) {
    throw new Error("No active poll found.")
  }

  const pollId = activePoll.id

  const response = await fetch(
    `https://api.groupme.com/v3/poll/${groupId}/${pollId}/end?token=${token}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    }
  )

  if (!response.ok) {
    captureGroupMeApiError("Failed to end poll.", {
      endpoint: "/v3/poll/:groupId/:pollId/end",
      method: "POST",
      status: response.status,
      statusText: response.statusText,
      groupId,
      pollId
    })
    throw new Error("Failed to end poll.")
  }

  const data = await response.json()
  return data
}

export default action
