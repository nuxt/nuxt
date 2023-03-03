/**
 * This file is used to wrap the CLI entrypoint in a restartable process.
 */
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'
import { EXIT_CODE_RESTART } from './constants'

const cliEntry = fileURLToPath(new URL('../dist/cli-run.mjs', import.meta.url))

async function startSubprocess (preArgs: string[], postArgs: string[]) {
  const child = await execa(
    'node',
    [
      ...preArgs,
      cliEntry,
      ...postArgs
    ],
    {
      reject: false,
      stdio: 'inherit',
      env: {
        ...process.env,
        NUXI_CLI_WRAPPER: 'true'
      }
    }
  )
  if (child.exitCode === EXIT_CODE_RESTART) {
    await startSubprocess(preArgs, postArgs)
  } else {
    process.exit(child.exitCode)
  }
}

const args = process.argv.slice(2)
// only enable wrapper in dev command
if (args[0] === 'dev') {
  startSubprocess([], args)
} else {
  import(cliEntry)
}
