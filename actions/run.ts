import { ActionOptions } from "../types"

const action = process.argv[2]
const botId = process.argv[3]
const groupId = process.argv[4]

async function run() {
  const actionFn = (await import(`./${action}/action.ts`)).default

  const result = await actionFn({
    botId,
    group_id: groupId as string
  } as Partial<ActionOptions>)
  console.log("Result:", result)
}

run()

export {}
