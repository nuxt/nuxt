import { spawn } from 'node:child_process'
import { mkdir, readFile, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { allocatePort, quietEnv, waitForHttp } from './proc.ts'
import { fetchDocument } from './http.ts'
import { markdownTable } from './stats.ts'

interface ProfileNode {
  id: number
  callFrame: { functionName: string, url: string, lineNumber: number }
  children?: number[]
}

interface CpuProfile {
  nodes: ProfileNode[]
  samples: number[]
}

export interface ProfileOptions {
  cwd: string
  routes: { path: string, match: string }[]
  requests: number
  concurrency: number
  dir: string
  log: (message: string) => void
}

/**
 * Run the production server under `--cpu-prof`, load each route and return the frames with
 * the most self time, so a regression can be located without rerunning anything.
 */
export async function profileServer ({ cwd, routes, requests, concurrency, dir, log }: ProfileOptions): Promise<{ markdown: string, frames: Frame[] }> {
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  const port = allocatePort()
  const child = spawn(process.execPath, ['--cpu-prof', `--cpu-prof-dir=${dir}`, '--import', fileURLToPath(new URL('./exit-on-signal.mjs', import.meta.url)), '.output/server/index.mjs'], {
    cwd,
    env: { ...process.env, ...quietEnv, NODE_ENV: 'production', PORT: String(port), HOST: '127.0.0.1' },
    stdio: 'ignore',
  })
  const exited = new Promise<void>(resolve => child.on('exit', () => resolve()))
  try {
    const url = `http://127.0.0.1:${port}`
    for (const route of routes) {
      await waitForHttp(url + route.path, { match: route.match, timeout: 30_000 })
      let remaining = requests
      await Promise.all(Array.from({ length: concurrency }, async () => {
        while (remaining-- > 0) {
          await fetchDocument(url + route.path, route.match)
        }
      }))
    }
  } finally {
    child.kill('SIGINT')
    await Promise.race([exited, new Promise(resolve => setTimeout(resolve, 10_000))])
    if (child.exitCode === null) {
      child.kill('SIGKILL')
    }
  }

  const files = (await readdir(dir)).filter(file => file.endsWith('.cpuprofile'))
  if (!files.length) {
    log('profile: no cpu profile was written')
    return { markdown: '', frames: [] }
  }
  const profile = JSON.parse(await readFile(join(dir, files[0]!), 'utf8')) as CpuProfile
  const frames = topFrames(profile, 20, cwd)
  const markdown = markdownTable(['self time', 'function', 'location'], frames.map(frame => [
    `${frame.share.toFixed(1)}%`,
    `\`${frame.name}\``,
    frame.location ? `\`${frame.location}\`` : '',
  ]))
  return { markdown, frames }
}

export interface Frame {
  name: string
  location: string
  share: number
}

function topFrames (profile: CpuProfile, limit: number, cwd: string): Frame[] {
  const byId = new Map(profile.nodes.map(node => [node.id, node]))
  const self = new Map<string, { frame: Frame, samples: number }>()
  for (const id of profile.samples) {
    const { callFrame } = byId.get(id)!
    const key = `${callFrame.functionName}@${callFrame.url}:${callFrame.lineNumber}`
    const file = callFrame.url.replace(/^file:\/\//, '').replace(cwd + '/', '').replace(/^\.output\/server\/(node_modules\/)?/, '')
    const location = file ? `${file}:${callFrame.lineNumber + 1}` : ''
    const entry = self.get(key) ?? { frame: { name: callFrame.functionName || '(anonymous)', location, share: 0 }, samples: 0 }
    entry.samples++
    self.set(key, entry)
  }
  return [...self.values()]
    .sort((a, b) => b.samples - a.samples)
    .slice(0, limit)
    .map(({ frame, samples }) => ({ ...frame, share: 100 * samples / profile.samples.length }))
}
