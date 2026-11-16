import { readdirSync, readFileSync } from "fs"
import OpenAI from "openai"
import { zodTextFormat } from "openai/helpers/zod"
import { join } from "path"
import { z } from "zod"
import { GroupMeAttachment, GroupMeUser } from "../../types"

export type PoetryMode = "rhyme" | "haiku"

const namePlaceholder = "[[name]]"
const maxMessageLength = 1000
const poemSchema = z.object({
  verses: z.array(z.object({ lines: z.array(z.string()) }))
})

type Reminder = {
  text: string
  mentions: GroupMeAttachment & { type: "mentions" }
}

// Assemble mentions while inserting names, so duplicate nicknames, substrings,
// and names containing punctuation cannot accidentally mention the wrong player.
function renderVerses(verses: string[], users: GroupMeUser[], prefix: string) {
  const reminder: Reminder = {
    text: prefix ? `${prefix}\n\n` : "",
    mentions: { type: "mentions", loci: [], user_ids: [] }
  }

  verses.forEach((verse, index) => {
    const parts = verse.split(namePlaceholder)
    if (parts.length !== 2) {
      throw new Error("Each verse must contain exactly one name placeholder.")
    }

    if (index > 0) reminder.text += "\n\n"
    reminder.text += parts[0]
    const mention = `@${users[index].nickname}`
    reminder.mentions.loci.push([reminder.text.length, mention.length])
    reminder.mentions.user_ids.push(users[index].user_id)
    reminder.text += mention + parts[1]
  })

  if (reminder.text.length > maxMessageLength) {
    throw new Error("Reminder exceeds the single-message character budget.")
  }
  return reminder
}

export function createFallbackReminder(users: GroupMeUser[], prefix = "") {
  return renderVerses(
    users.map(() => namePlaceholder),
    users,
    [prefix, "Please vote in the soccer poll so we can plan the game!"]
      .filter(Boolean)
      .join("\n\n")
  )
}

export async function createPoeticReminder({
  users,
  mode,
  prefix = ""
}: {
  users: GroupMeUser[]
  mode: PoetryMode
  prefix?: string
}): Promise<Reminder> {
  const personaFiles = readdirSync(__dirname).filter((file) =>
    /^instructions-\d+\.md$/.test(file)
  )
  if (!personaFiles.length) throw new Error("No nudge personas found.")
  const personaFile =
    personaFiles[Math.floor(Math.random() * personaFiles.length)]
  const instructions = [
    readFileSync(join(__dirname, personaFile), "utf-8"),
    readFileSync(join(__dirname, "poetry-instructions.md"), "utf-8")
  ].join("\n\n")

  // Construct lazily so other bot actions still work without an OpenAI key.
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 15_000,
    maxRetries: 0
  })
  let validationError = ""
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.responses.parse({
      model: "gpt-6.1-sol",
      reasoning: { effort: "low" },
      // @ts-expect-error SDK 4.96 predates the documented Fast tier; it forwards this value unchanged.
      service_tier: "fast",
      instructions,
      input: JSON.stringify({
        mode,
        players: users.map((user) => ({ name: user.nickname })),
        max_poem_characters: maxMessageLength - (prefix ? prefix.length + 2 : 0),
        correction: validationError
      }),
      text: { format: zodTextFormat(poemSchema, "poll_reminder_poem") },
      max_output_tokens: 2000,
      store: false
    })

    try {
      if (response.status !== "completed" || !response.output_parsed) {
        throw new Error("No complete poem was generated.")
      }
      const { verses } = poemSchema.parse(response.output_parsed)
      if (verses.length !== users.length) {
        throw new Error("Write exactly one verse per player, in input order.")
      }
      const renderedVerses = verses.map(({ lines }) => {
        const expectedLines = mode === "haiku" ? 3 : 2
        if (
          lines.length !== expectedLines ||
          lines.some((line) => !line.trim() || /[\r\n]/.test(line))
        ) {
          throw new Error(
            `Each verse must have exactly ${expectedLines} nonempty lines.`
          )
        }
        if (
          mode === "rhyme" &&
          !lines.some((line) => /\[\[name\]\][.!?,;:]*$/.test(line.trim()))
        ) {
          throw new Error(
            "Place the name placeholder at the end of a rhyming line."
          )
        }
        return lines.map((line) => line.trim()).join("\n")
      })
      return renderVerses(renderedVerses, users, prefix)
    } catch (error) {
      validationError = (error as Error).message
    }
  }
  throw new Error(`Could not generate a valid reminder: ${validationError}`)
}
