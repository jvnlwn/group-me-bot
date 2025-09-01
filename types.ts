export type BotCallbackData = {
  attachments: any[]
  avatar_url: string
  created_at: number
  group_id: string
  id: string
  name: string
  sender_id: string
  sender_type: string
  source_guid: string
  system: boolean
  text: string
  user_id: string
}

export type GroupMePoll = {
  id: string
  subject: string
  owner_id: string
  conversation_id: string
  created_at: number
  expiration: number
  status: string
  options: {
    id: string
    title: string
    votes: number
    voter_ids: string[]
  }[]
  last_modified: number
  type: string
  visibility: string
  user_votes: string[]
}

export type GroupMeUser = {
  user_id: string
  nickname: string
  muted: boolean
  image_url: string
}

export type GroupMeGroup = {
  id: string
  name: string
  type: string
  description: string
  image_url: string
  creator_user_id: string
  created_at: number
  updated_at: number
  members: GroupMeUser[]
  share_url: string
  messages: {
    count: number
    last_message_id: string
    last_message_created_at: number
    preview: {
      nickname: string
      text: string
      image_url: string
      attachments: (
        | {
            type: "image"
            url: string
          }
        | {
            type: "location"
            lat: string
            lng: string
            name: string
          }
        | {
            type: "split"
            token: string
          }
        | {
            type: "emoji"
            placeholder: string
            charmap: [number, number][]
          }
      )[]
    }
  }
}

// Optional attachments which can be used to @mention users in the message.
// - `text` must include the user's name exactly where you want the mention (@JohnDoe in the example).
// - `loci` is an array: [startIndex, length] of the mention inside the text. (0-based index.)
// - `user_ids` is an array of GroupMe user ID strings, not @handles or names.
// - The "mention" will show up properly as a clickable @mention in the GroupMe app.
export type GroupMeAttachment =
  | {
      type: "mentions"
      loci: [number, number][]
      user_ids: string[]
    }
  | {
      type: "reply"
      reply_id: string
      base_reply_id: string
    }
  | {
      type: "poll"
      poll_id: string
    }

export type ActionFn = (
  options: BotCallbackData & { botId: string }
) => Promise<any>

export type GroupMePinnedMessage = {
  attachments: GroupMeAttachment[]
  avatar_url: string
  created_at: number
  favorited_by: string[]
  group_id: string
  id: string
  name: string
  sender_id: string
  sender_type: string
  source_guid: string
  system: boolean
  text: string
  user_id: string
  event: {
    type: "poll.created" | string
    data: {
      conversation: { id: string }
      poll: { id: string; subject: string }
      user: { id: string; nickname: string }
    }
  }
  platform: string
  pinned_at: number
  pinned_by: string
}

export type GroupMeMessage = {
  attachments: GroupMeAttachment[]
  avatar_url: string
  created_at: number
  group_id: string
  id: string
  name: string
  sender_id: string
  sender_type: string
  source_guid: string
  text: string
}
