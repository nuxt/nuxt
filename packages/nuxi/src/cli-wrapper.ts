/**
 * This file is used to wrap the CLI entrypoint in a restartable process.
 */
import { fileURLToPath } from 'node:url'
import { fork } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'

const cliEntry = new URL('../dist/cli-run.mjs', import.meta.url)

// Only enable wrapper for nuxt dev command
if (process.argv[2] === 'dev') {
  process.env.__CLI_ARGV__ = JSON.stringify(process.argv)
  startSubprocess()
} else {
  import(cliEntry.href)
}

function startSubprocess () {
  let childProc: ChildProcess | undefined

  const onShutdown = () => {
    if (childProc) {
      childProc.kill()
      childProc = undefined
    }
  }

  process.on('exit', onShutdown)
  process.on('SIGTERM', onShutdown) // Graceful shutdown
  process.on('SIGINT', onShutdown) // Ctrl-C
  process.on('SIGQUIT', onShutdown) // Ctrl-\

  start()

  function start () {
    const _argv: string[] = (process.env.__CLI_ARGV__ ? JSON.parse(process.env.__CLI_ARGV__) : process.argv).slice(2)
    const execArguments: string[] = getInspectArgs()

    childProc = fork(fileURLToPath(cliEntry), [], { execArgv: execArguments })
    childProc.on('close', (code) => { if (code) { process.exit(code) } })
    childProc.on('message', (message) => {
      if ((message as { type: string })?.type === 'nuxt:restart') {
        childProc?.kill()
        startSubprocess()
      }
    })

    function getInspectArgs (): string[] {
      const inspectArgv = _argv.find(argvItem => argvItem.includes('--inspect'))

      if (!inspectArgv) {
        return []
      }

      return [inspectArgv]
    }
  }
}
