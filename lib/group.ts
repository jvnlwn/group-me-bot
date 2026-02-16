import { captureGroupMeApiError } from "./sentry"
import { GroupMeGroup } from "../types"

const token = process.env.GROUP_ME_API_ACCESS_TOKEN

// Util for getting a list of users who have not yet responded to a poll in a groupme group.
export async function getGroup({ groupId }: { groupId: string | number }) {
  const response = await fetch(
    `https://api.groupme.com/v3/groups/${groupId}?token=${token}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    }
  )

  if (!response.ok) {
    captureGroupMeApiError("Failed get group.", {
      endpoint: "/v3/groups/:groupId",
      method: "GET",
      status: response.status,
      statusText: response.statusText,
      groupId: String(groupId)
    })
    throw new Error("Failed get group.")
  }

  const { response: data } = (await response.json()) as {
    response: GroupMeGroup
  }

  return data
}
