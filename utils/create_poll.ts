type CreatePollOptions = {
  groupId: string | number
}

// Util for creating a poll in a groupme group.
// The poll is hardcoded to ask if people are coming tomorrow for soccer,
// so, very specific use case.
async function createPoll({ groupId }: CreatePollOptions) {
  const token = process.env.GROUP_ME_API_ACCESS_TOKEN
  const response = await fetch(
    `https://api.groupme.com/v3/poll/${groupId}?token=${token}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        subject: "Coming tomorrow?",
        options: [{ title: "Yes" }, { title: "No" }],
        // Expire 12 hours from now.
        expiration: Math.floor(
          new Date(Date.now() + 1000 * 60 * 60 * 12).getTime() / 1000
        ),
        visibility: "public",
        type: "single"
      })
    }
  )

  if (!response.ok) {
    throw new Error("Failed to create poll")
  }

  const data = await response.json()
  return data
}

export default createPoll
