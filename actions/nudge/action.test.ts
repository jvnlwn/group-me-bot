import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import handler from "../../api/group/[group_id]/poll_reminder"
import post from "../../bot/post"
import { getGroup } from "../../lib/group"
import { getMemberVote, getNonPolledUsers, getPolls } from "../../lib/poll"
import { captureApiError } from "../../lib/sentry"
import { ActionOptions, GroupMeUser } from "../../types"
import { getCurrentPollResultsText } from "../check/action"
import action, { nudge } from "./action"
import { createPoeticReminder, PoetryMode } from "./poetry"

const { parse } = vi.hoisted(() => ({ parse: vi.fn() }))
vi.mock("openai", () => ({
  default: class {
    responses = { parse }
  }
}))
vi.mock("../../bot/post", () => ({ default: vi.fn() }))
vi.mock("../../lib/group", () => ({ getGroup: vi.fn() }))
vi.mock("../../lib/poll", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lib/poll")>()),
  getPolls: vi.fn(),
  getNonPolledUsers: vi.fn(),
  getMemberVote: vi.fn()
}))
vi.mock("../../lib/sentry", () => ({ captureApiError: vi.fn() }))
vi.mock("../../lib/schema", () => ({
  getGroupAndBotId: () => ({ groupId: "test-group", botId: "test-bot" })
}))
vi.mock("../check/action", () => ({ getCurrentPollResultsText: vi.fn() }))

const user = (user_id: string, nickname: string): GroupMeUser => ({
  user_id,
  nickname,
  muted: false,
  image_url: ""
})
const sam = user("sam", "Sam")
const may = user("may", "May")
const inactive = user("inactive", "Inactive")
const rhymeVerses = [
  ["Vote yes or no, join the jam,", "The pitch is calling, [[name]]!"],
  ["Cast your vote and claim the day,", "The pitch awaits you, [[name]]!"]
]
const haikuVerses = [
  ["[[name]], the dawn is near", "Cast your vote upon the breeze", "Boots wait by the door"],
  ["Soft dew waits for [[name]]", "Let the team know with a vote", "Dawn lights up the pitch"]
]
const response = (verses: string[][]) => ({
  status: "completed",
  output_parsed: { verses: verses.map((lines) => ({ lines })) }
})
const options = { botId: "test-bot", groupId: "test-group", count: Infinity }
const command = (text: string): ActionOptions => ({
  botId: "test-bot",
  group_id: "test-group",
  id: "command",
  text,
  attachments: [],
  avatar_url: "",
  created_at: 0,
  name: "Test user",
  sender_id: "test-user",
  sender_type: "user",
  source_guid: "test-command",
  system: false,
  user_id: "test-user"
})

beforeEach(() => {
  vi.resetAllMocks()
  // Fail closed if a test ever reaches a real network call.
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network disabled in tests") }))
  vi.mocked(getGroup).mockResolvedValue({ members: [sam, may, inactive] } as Awaited<ReturnType<typeof getGroup>>)
  vi.mocked(getPolls).mockResolvedValue({ polls: [], continuationToken: null })
  vi.mocked(getNonPolledUsers).mockResolvedValue([may, inactive, sam])
  vi.mocked(getMemberVote).mockResolvedValue({ sam: [1], may: [-1], inactive: [0] })
  vi.mocked(getCurrentPollResultsText).mockResolvedValue("Current Poll Results: 8 Yes, 2 No")
  parse.mockResolvedValue(response(rhymeVerses))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe("poetic nudges", () => {
  test.each<{ mode: PoetryMode; verses: string[][] }>([
    { mode: "rhyme", verses: rhymeVerses },
    { mode: "haiku", verses: haikuVerses }
  ])("posts all $mode verses once with inline mentions and a reply", async ({ mode, verses }) => {
    parse.mockResolvedValue(response(verses))
    await nudge({ ...options, mode, messageId: "command-id" })

    expect(parse).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledTimes(1)
    const sent = vi.mocked(post).mock.calls[0][0]
    expect(sent.text).toBe(verses.map((lines, i) => lines.join("\n").replace("[[name]]", i === 0 ? "@Sam" : "@May")).join("\n\n"))
    expect(sent.text).not.toContain("Inactive")
    expect(sent.attachments).toEqual([
      {
        type: "mentions",
        loci: [[sent.text.indexOf("@Sam"), 4], [sent.text.indexOf("@May"), 4]],
        user_ids: ["sam", "may"]
      },
      { type: "reply", reply_id: "command-id", base_reply_id: "command-id" }
    ])
    const request = parse.mock.calls[0][0]
    expect(request).toMatchObject({
      model: "gpt-6.1-sol",
      reasoning: { effort: "low" },
      max_output_tokens: 2000,
      store: false
    })
    expect(JSON.parse(request.input)).toMatchObject({ mode, players: [{ name: "Sam" }, { name: "May" }] })
    expect(request.instructions).toContain("# Identity")
    expect(request.instructions).toContain("# Poll reminder poetry")
    expect(request.instructions).toContain("5/7/5")
  })

  test.each(["/nudge 2 haiku", "/nudge haiku 2"])("accepts count and mode in %s", async (text) => {
    parse.mockResolvedValue(response(haikuVerses))
    await action(command(text))
    expect(JSON.parse(parse.mock.calls[0][0].input)).toMatchObject({ mode: "haiku", players: [{ name: "Sam" }, { name: "May" }] })
    expect(post).toHaveBeenCalledTimes(1)
  })

  test("keeps the default count of one and chooses rhyme randomly", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    parse.mockResolvedValue(response([rhymeVerses[0]]))
    await action(command("/nudge"))
    expect(JSON.parse(parse.mock.calls[0][0].input)).toMatchObject({ mode: "rhyme", players: [{ name: "Sam" }] })
    expect(post).toHaveBeenCalledTimes(1)
  })

  test("can randomly choose haiku", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.9)
    parse.mockResolvedValue(response(haikuVerses))
    await nudge(options)
    expect(JSON.parse(parse.mock.calls[0][0].input).mode).toBe("haiku")
    expect(post).toHaveBeenCalledTimes(1)
  })

  test("keeps duplicate, overlapping, and Unicode names mapped to the right IDs", async () => {
    const users = [user("1", "Ann"), user("2", "Anna"), user("3", "Ann"), user("4", "Zoë ⚽️")]
    parse.mockResolvedValue(response(users.map(() => ["⚽️ Vote and be seen,", "Come join us, [[name]]!"])))
    const result = await createPoeticReminder({ users, mode: "rhyme", prefix: "⚽️ Poll results" })
    expect(result.mentions.user_ids).toEqual(["1", "2", "3", "4"])
    expect(result.mentions.loci.map(([start, length]) => result.text.slice(start, start + length))).toEqual(users.map((u) => `@${u.nickname}`))
    expect(new Set(result.mentions.loci.map(([start]) => start)).size).toBe(4)
  })

  test.each([
    { label: "missing player", verses: [rhymeVerses[0]] },
    { label: "missing name", verses: [["Vote for the day", "Come out and play"], rhymeVerses[1]] },
    { label: "duplicate name", verses: [["[[name]] joins the jam", "Vote now, [[name]]"], rhymeVerses[1]] },
    { label: "name mid-line", verses: [["[[name]], vote now", "Show us how"], rhymeVerses[1]] },
    { label: "wrong line count", verses: [["Vote now, [[name]]"], rhymeVerses[1]] },
    { label: "embedded newline", verses: [["Vote\nnow", "Here, [[name]]"], rhymeVerses[1]] },
    { label: "over budget", verses: [["a".repeat(1000), "Vote, [[name]]"], rhymeVerses[1]] }
  ])("regenerates a poem with $label before posting", async ({ verses }) => {
    parse.mockResolvedValueOnce(response(verses)).mockResolvedValueOnce(response(rhymeVerses))
    await nudge({ ...options, mode: "rhyme" })
    expect(parse).toHaveBeenCalledTimes(2)
    expect(JSON.parse(parse.mock.calls[1][0].input).correction).not.toBe("")
    expect(post).toHaveBeenCalledTimes(1)
    expect(vi.mocked(post).mock.calls[0][0].text).toContain("The pitch is calling, @Sam!")
  })

  test.each([
    { label: "refusal", result: { status: "completed", output_parsed: null } },
    { label: "incomplete response", result: { status: "incomplete", output_parsed: null } },
    { label: "invalid verses", result: response([]) }
  ])("falls back to one complete reminder after $label", async ({ result }) => {
    parse.mockResolvedValue(result)
    await nudge({ ...options, mode: "rhyme" })
    expect(post).toHaveBeenCalledTimes(1)
    expect(vi.mocked(post).mock.calls[0][0].text).toContain("Please vote in the soccer poll")
    expect(vi.mocked(post).mock.calls[0][0].attachments?.[0]).toMatchObject({ user_ids: ["sam", "may"] })
    expect(captureApiError).toHaveBeenCalledTimes(1)
  })

  test("falls back on an OpenAI error and retains results and reply", async () => {
    parse.mockRejectedValue(new Error("OpenAI unavailable"))
    await nudge({ ...options, includePollResults: true, messageId: "command" })
    expect(post).toHaveBeenCalledTimes(1)
    const sent = vi.mocked(post).mock.calls[0][0]
    expect(sent.text).toContain("Current Poll Results: 8 Yes, 2 No")
    expect(sent.text).toContain("@Sam")
    expect(sent.text).toContain("@May")
    expect(sent.attachments?.[1]).toMatchObject({ type: "reply", reply_id: "command" })
  })

  test("does not try a second post if GroupMe fails", async () => {
    vi.mocked(post).mockRejectedValue(new Error("GroupMe unavailable"))
    await expect(nudge({ ...options, mode: "rhyme" })).rejects.toThrow("GroupMe unavailable")
    expect(post).toHaveBeenCalledTimes(1)
  })

  test("does not generate or post when nobody is eligible for a manual nudge", async () => {
    vi.mocked(getNonPolledUsers).mockResolvedValue([])
    await expect(nudge(options)).rejects.toThrow("No players to nudge.")
    expect(parse).not.toHaveBeenCalled()
    expect(post).not.toHaveBeenCalled()
  })
})

describe("scheduled poll reminders", () => {
  const runHandler = async () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    await handler(
      { method: "POST", query: { group_id: "test-group" } } as unknown as Parameters<typeof handler>[0],
      res as unknown as Parameters<typeof handler>[1]
    )
    return res
  }

  test("posts results and all verses in one message", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0)
    await runHandler()
    expect(post).toHaveBeenCalledTimes(1)
    const sent = vi.mocked(post).mock.calls[0][0]
    expect(sent.text).toMatch(/^Current Poll Results: 8 Yes, 2 No\n\nVote/)
    expect(sent.attachments?.[0]).toEqual({
      type: "mentions",
      user_ids: ["sam", "may"],
      loci: [[sent.text.indexOf("@Sam"), 4], [sent.text.indexOf("@May"), 4]]
    })
  })

  test("posts only results when everyone has voted", async () => {
    vi.mocked(getNonPolledUsers).mockResolvedValue([])
    await runHandler()
    expect(post).toHaveBeenCalledExactlyOnceWith({ botId: "test-bot", text: "Current Poll Results: 8 Yes, 2 No" })
    expect(parse).not.toHaveBeenCalled()
  })

  test("returns once without posting when there is no active poll", async () => {
    vi.mocked(getNonPolledUsers).mockRejectedValue(new Error("No active poll found."))
    const res = await runHandler()
    expect(res.json).toHaveBeenCalledExactlyOnceWith({ message: "No active poll found." })
    expect(post).not.toHaveBeenCalled()
    expect(parse).not.toHaveBeenCalled()
  })
})
