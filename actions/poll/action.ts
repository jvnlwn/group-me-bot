import { getActivePoll, getPolls } from "../../lib/poll"
import { ActionFn } from "../../types"

// Util for creating a poll in a groupme group.
// The poll is hardcoded to ask if people are coming tomorrow for soccer,
// so, very specific use case.

// TODO: first check if a poll is already active!
const action: ActionFn = async ({ group_id: groupId }) => {
  const token = process.env.GROUP_ME_API_ACCESS_TOKEN

  const activePoll = await getActivePoll({ polls: await getPolls({ groupId }) })

  if (activePoll) {
    throw new Error("An active poll already exists.")
  }

  const response = await fetch(
    `https://api.groupme.com/v3/poll/${groupId}?token=${token}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        subject: "⚽",
        options: [{ title: "Yes" }, { title: "No" }],
        expiration: Math.floor(
          // 12 hours from now
          // new Date(Date.now() + 1000 * 60 * 60 * 12).getTime() / 1000
          // 9 PM EST, current day (doesn't take into account DST).
          new Date(
            new Date().setHours(21, 0, 0, 0) + 1000 * 60 * 60 * 12
          ).getTime() / 1000
        ),
        visibility: "public",
        type: "single"
      })
    }
  )

  if (!response.ok) {
    throw new Error("Failed to create poll.")
  }

  const data = await response.json()
  return data
}

export default action
