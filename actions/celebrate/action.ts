import * as Sentry from "@sentry/node"
import post from "../../bot/post"
import { getAtMentionsAttachment } from "../../lib/attachment"
import { getGroup } from "../../lib/group"
import { getAllMessages } from "../../lib/message"
import { getAllPolls, getPollIsSoccer } from "../../lib/poll"
import {
  ActionFn,
  GroupMeAttachment,
  GroupMeGroup,
  GroupMeUser
} from "../../types"

type MemberStats = {
  member: GroupMeUser
  yesCount: number
  yesPerc: number
  yesStreak: number
  years: number
}

type MembershipJoinedDates = Record<string, number>

// Intended for manual execution unitl we setup separate db for storing this data.
// Group Me does not provide membership creation dates!
async function _writeMembershipJoinedDates(group: GroupMeGroup) {
  const messages = await getAllMessages({ groupId: group.id })

  const membershipJoinedDates = messages.reduce((acc, message) => {
    let userIds: string[] = []

    if (message.sender_type !== "system") return acc

    if (message.event?.type === "membership.announce.joined") {
      userIds.push(message.event?.data?.user?.id)
    }
    if (message.event?.type === "membership.announce.added") {
      userIds.push(...message.event?.data?.added_users.map((user) => user.id))
    }
    userIds.forEach((userId) => {
      acc[userId] = message.created_at
    })
    return acc
  }, {} as MembershipJoinedDates)

  // User who created the group would not have been added.
  // But may no longer be assigned as creator, so conditionally set.
  // Unclear exactly how this could be, but there is a case where the original
  // user to add other users yet not added themselves is not assigned as the group creator.
  membershipJoinedDates[group.creator_user_id] ??= group.created_at

  const path = require("path")
  const fs = require("fs")
  const dataPath = path.join(
    __dirname,
    `./data/membership-joined-dates-${group.id}.json`
  )
  fs.writeFileSync(dataPath, JSON.stringify(membershipJoinedDates, null, 2))
}

async function _getMemberJoinedDates(group: GroupMeGroup) {
  try {
    const membershipJoinedDates = (
      await import(`./data/membership-joined-dates-${group.id}.json`)
    ).default
    return membershipJoinedDates as MembershipJoinedDates
  } catch (error) {
    if (process.env.NODE_ENV === "production") throw error

    console.log(
      "Error reading membership joined dates, writing new file.",
      error
    )

    await _writeMembershipJoinedDates(group)
    return await _getMemberJoinedDates(group)
  }
}

function ordinal(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ??
        "th")

  return `${n}${suffix}`
}

export async function celebrate({
  botId,
  groupId
}: {
  botId: string
  groupId: string
}) {
  const yearAgoDate = new Date()
  yearAgoDate.setFullYear(new Date().getFullYear() - 1)

  const group = await getGroup({ groupId })
  const allPolls = await getAllPolls({ groupId, fromDate: yearAgoDate })
  const polls = allPolls.filter(
    (poll) => poll.status !== "active" && getPollIsSoccer(poll)
  )

  const members = [...group.members]
  const membershipJoinedDates = await _getMemberJoinedDates(group)

  // Get a set of members that have "yes" voted in the last year.
  const activeMembers = polls.reduce((acc, poll) => {
    const voterIds = poll.options.flatMap(
      (option) => option.voter_ids?.filter((voterId) => voterId !== botId) ?? []
    )
    voterIds.forEach((voterId) => {
      const memberIndex = members.findIndex(
        (member) => member.user_id === voterId
      )
      const member = members[memberIndex]
      if (member) {
        acc.push(member)
        members.splice(memberIndex, 1)
      }
    })
    return acc
  }, [] as GroupMeUser[])

  const celebrateMembers = activeMembers.filter((member) => {
    const joinedDate = membershipJoinedDates[member.user_id]
    if (!joinedDate) return
    // Only include member active poll is only poll occurring after their anniversary date.
    const anniversaryDate = new Date(joinedDate * 1000)
    // If the date joined is this year, don't celebrate.
    if (anniversaryDate.getFullYear() === new Date().getFullYear()) return
    // Set the year to the current year.
    anniversaryDate.setFullYear(new Date().getFullYear())
    // Polls are ordered newest to oldest, so slicing the first two is sufficient
    // since we only need to know if there's exactly one poll past the anniversary date.
    const pollsPastAnniversary = polls.slice(0, 3).filter((poll) => {
      const pollDate = new Date(poll.created_at * 1000)
      return pollDate > anniversaryDate
    })

    return pollsPastAnniversary.length === 1
  })

  // Assemble member stats for each member.
  const memberStats = celebrateMembers.map<MemberStats>((member) => {
    let yesCount = 0
    let yesStreak = 0
    let currentYesStreak = 0
    for (const poll of polls) {
      const option = poll.options.find(
        (option) =>
          option.title.toLowerCase() === "yes" &&
          option.voter_ids?.includes(member.user_id)
      )
      if (option) {
        currentYesStreak++
        yesCount++
        if (currentYesStreak > yesStreak) {
          yesStreak = currentYesStreak
        }
      } else {
        currentYesStreak = 0
      }
    }
    const yesPerc = yesCount / polls.length
    const joinedDate = membershipJoinedDates[member.user_id]
    const years =
      new Date().getFullYear() - new Date(joinedDate * 1000).getFullYear()
    return {
      member,
      yesCount,
      yesPerc,
      yesStreak,
      years
    }
  })

  if (memberStats.length === 0) {
    return
  }

  const attachments: GroupMeAttachment[] = memberStats.map((stats) =>
    getAtMentionsAttachment({
      users: [stats.member],
      text: stats.member.nickname
    })
  )

  const text = memberStats.reduce((acc, stats) => {
    let text = `🎉⚽️🎉 Happy ${ordinal(stats.years)} anniversary, @${stats.member.nickname}! A recap of your year:\nVoted "Yes" ${stats.yesCount}x (${Math.round(stats.yesPerc * 100)}%) with a ${stats.yesStreak}x streak.`
    return acc ? `${acc}\n\n${text}` : text
  }, "")

  Sentry.withScope((scope) => {
    scope.setTag("text", text)
    scope.setTag("polls_lenght", polls.length)
    Sentry.captureException("Celebrate action.")
  })

  await post({
    botId,
    text,
    attachments
  })
}

const action: ActionFn = async ({ botId, group_id: groupId }) => {
  return celebrate({
    botId,
    groupId
  })
}

export default action
