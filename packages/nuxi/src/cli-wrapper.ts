/**
 * This file is used to wrap the CLI entrypoint in a restartable process.
 */
import { fileURLToPath } from 'node:url'
import { fork } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'

const cliEntry = fileURLToPath(new URL('../dist/cli-run.mjs', import.meta.url))

// Only enable wrapper for nuxt dev command
if (process.argv[2] === 'dev') {
  process.env.__CLI_ARGV__ = JSON.stringify(process.argv)
  startSubprocess()
} else {
  import(cliEntry)
}

function startSubprocess () {
  let childProc: ChildProcess

  process.on('exit', () => {
    if (childProc) {
      childProc.kill()
    }
  })

  start()

  function start () {
    childProc = fork(cliEntry)
    childProc.on('close', (code) => { if (code) { process.exit(code) } })
    childProc.on('message', (message) => {
      if ((message as { type: string })?.type === 'nuxt:restart') {
        childProc.kill()
        startSubprocess()
      }
    })
  }
}
