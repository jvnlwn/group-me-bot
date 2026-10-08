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

// Example:
// GROUP_ME_API_ACCESS_TOKEN=f12b62f03ad9013fe1bf52405d16c202 npx tsx actions/run.js celebrate a325775515f6b6edb0c14ad29b 107215974
// GROUP_ME_API_ACCESS_TOKEN=f12b62f03ad9013fe1bf52405d16c202 npx tsx actions/run.js celebrate 87d35d9fa0f428049f8d990150 88389561

export {}
