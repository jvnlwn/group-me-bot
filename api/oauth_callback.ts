import { VercelRequest, VercelResponse } from "@vercel/node"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { access_token } = req.query
  res.status(200).json({ message: `Group Me Access Token: ${access_token}` })
}