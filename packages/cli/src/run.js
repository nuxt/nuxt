import fs from 'fs'
import execa from 'execa'
import NuxtCommand from './command'
import setup from './setup'
import getCommand from './commands'

export default async function run(_argv) {
  debugger
  // Read from process.argv 
  // Array.from은 받은 인자를 배열의 형태로 리턴
  const argv = _argv ? Array.from(_argv) : process.argv.slice(2)

  // Check for internal command
  // argv의 맨 첫 번째 엘리먼트가 cmd가 될 거임
  let cmd = await getCommand(argv[0])

  // Matching `nuxt` or `nuxt [dir]` or `nuxt -*` for `nuxt dev` shortcut
  if (!cmd && (!argv[0] || argv[0][0] === '-' || fs.existsSync(argv[0]))) {
    argv.unshift('dev')
    cmd = await getCommand('dev') // 예시가 될 수 있음
  }

  // Setup env
  setup({ dev: argv[0] === 'dev' })

  // Try internal command
  if (cmd) {
    // argv의 첫 번째 엘리먼트를 cmd로(예를 들어 dev), 첫 번째 엘리먼트 제외한 엘리먼트들을 argv.slice(1)로 보냄
    return NuxtCommand.run(cmd, argv.slice(1))
  }

  // Try external command
  try {
    await execa(`nuxt-${argv[0]}`, argv.slice(1), {
      stdout: process.stdout,
      stderr: process.stderr,
      stdin: process.stdin
    })
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw String(`Command not found: nuxt-${argv[0]}`)
    }
    throw String(`Failed to run command \`nuxt-${argv[0]}\`:\n${error}`)
  }
}
