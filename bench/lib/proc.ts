import type { Buffer } from 'node:buffer'
import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import process from 'node:process'

interface RunOptions {
  cwd?: string
  env?: Record<string, string | undefined>
  timeout?: number
}

interface RunResult {
  /** Milliseconds from spawn to exit. */
  wall: number
  stdout: string
  stderr: string
}

export const quietEnv = { NO_COLOR: '1', NUXT_TELEMETRY_DISABLED: '1', CI: '1' }

/** Run a command to completion, throwing with the tail of its output if it fails. */
export async function run (command: string, args: string[], options: RunOptions = {}): Promise<RunResult> {
  const started = performance.now()
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  })

  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
  child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

  const timer = setTimeout(kill, options.timeout ?? 300_000, child)
  const code = await new Promise<number | null>((resolve) => {
    child.on('close', resolve)
  })
  clearTimeout(timer)
  const wall = performance.now() - started

  if (code !== 0) {
    throw new Error(`\`${[command, ...args].join(' ')}\` exited with ${code}:\n${(stdout + stderr).slice(-3000)}`)
  }
  return { wall, stdout, stderr }
}

function kill (child: ChildProcess): void {
  if (child.exitCode !== null || child.signalCode !== null) {
    return
  }
  try {
    process.kill(-child.pid!, 'SIGKILL')
  } catch {
    child.kill('SIGKILL')
  }
}

interface BackgroundProcess {
  child: ChildProcess
  output: () => string
  stop: () => Promise<void>
}

export function start (command: string, args: string[], options: RunOptions = {}): BackgroundProcess {
  let buffer = ''
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  })
  const onData = (chunk: Buffer) => { buffer += chunk.toString() }
  child.stdout.on('data', onData)
  child.stderr.on('data', onData)

  return {
    child,
    output: () => buffer,
    async stop () {
      if (child.exitCode !== null || child.signalCode !== null) {
        return
      }
      const closed = new Promise(resolve => child.on('close', resolve))
      kill(child)
      await closed
    },
  }
}

/** Poll `url` until it responds with a 2xx containing `match`, resolving with the milliseconds since `since`. */
export async function waitForHttp (url: string, options: { since?: number, timeout?: number, interval?: number, match?: string, server?: BackgroundProcess } = {}): Promise<number> {
  const since = options.since ?? performance.now()
  const timeout = options.timeout ?? 300_000
  while (performance.now() - since < timeout) {
    if (options.server && (options.server.child.exitCode !== null || options.server.child.signalCode !== null)) {
      throw new Error(`server exited before ${url} responded:\n${options.server.output().slice(-3000)}`)
    }
    try {
      const response = await fetch(url)
      const body = await response.text()
      if (response.ok && (!options.match || body.includes(options.match))) {
        return performance.now() - since
      }
    } catch {
      // the server is not accepting connections yet
    }
    await new Promise(resolve => setTimeout(resolve, options.interval ?? 20))
  }
  throw new Error(`timed out waiting for ${url}${options.server ? `:\n${options.server.output().slice(-3000)}` : ''}`)
}

let nextPort = 31_000

export function allocatePort (): number {
  return nextPort++
}
