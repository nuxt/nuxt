#!/usr/bin/env node
import { fileURLToPath } from 'node:url'
import { execa } from 'execa'

const EXIT_CODE_RESTART = 44

const ENTRY = new URL('../dist/cli-run.mjs', import.meta.url)

async function start (preArgs, postArgs) {
  const child = await execa(
    'node',
    [
      ...preArgs,
      fileURLToPath(ENTRY),
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
    await start(preArgs, postArgs)
  } else {
    process.exit(child.exitCode)
  }
}

start([], process.argv.slice(2))
