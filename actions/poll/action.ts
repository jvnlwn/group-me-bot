import { DateTime } from "luxon"
import { getActivePoll, getPolls } from "../../lib/poll"
import { ActionFn } from "../../types"

// Util for creating a poll in a groupme group.
// The poll is hardcoded to ask if people are coming tomorrow for soccer,
// so, very specific use case.
const action: ActionFn = async ({ group_id: groupId, created_at }) => {
  const token = process.env.GROUP_ME_API_ACCESS_TOKEN

  const activePoll = await getActivePoll({ polls: await getPolls({ groupId }) })

  if (activePoll) {
    throw new Error("An active poll already exists.")
  }

  // Set the expiration relative to the created date.
  const epxirationUTCDate = new Date(created_at * 1000)

  // Create a date expiring at 9pm ET. You may have to define timezone for
  // each group if you don't want to hardcode this.
  const epxirationETDateTime = DateTime.fromObject(
    {
      year: epxirationUTCDate.getFullYear(),
      month: epxirationUTCDate.getMonth() + 1,
      day: epxirationUTCDate.getDate(),
      hour: 21,
      minute: 0
    },
    { zone: "America/New_York" }
  )

  // Now convert to UTC JS Date.
  const expirationUTCTime =
    epxirationETDateTime.toUTC().toJSDate().getTime() / 1000

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
        expiration: expirationUTCTime,
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
