import { VercelRequest, VercelResponse } from "@vercel/node"
import createPoll from "../utils/create_poll"

// Endpoing for testing creaating a poll for the test group 107215974.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const groupId = 107215974

  try {
    const data = await createPoll({ groupId })
    res.status(200).json(data)
  } catch (error) {
    res.status(500).json({ error: "Failed to create poll" })
  }
}
