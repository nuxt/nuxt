import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { watch } from 'chokidar'
import { join } from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { recoverThrottledChanges } from './watch.ts'

const temporaryDirectories: string[] = []
const disposers: Array<() => unknown> = []

async function createWatcher (recover: boolean, cwd?: boolean) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), 'nuxt-watch-')))
  temporaryDirectories.push(dir)

  const file = join(dir, 'component.vue')
  await writeFile(file, '<template>0</template>')

  const watcher = cwd
    ? watch('component.vue', { cwd: dir, ignoreInitial: true })
    : watch(dir, { ignoreInitial: true })
  disposers.push(() => watcher.close())
  if (recover) {
    disposers.push(recoverThrottledChanges(watcher))
  }

  const emitted = cwd ? 'component.vue' : file
  const seen: string[] = []
  watcher.on('change', (path) => {
    if (path === emitted) { seen.push(path) }
  })
  await new Promise<void>(resolve => watcher.on('ready', () => resolve()))

  return { file, seen, watcher }
}

async function saveTwice (file: string) {
  await writeFile(file, '<template>1</template>')
  await new Promise(resolve => setTimeout(resolve, 25))
  await writeFile(file, '<template>2</template>')
}

describe('recoverThrottledChanges', () => {
  afterEach(async () => {
    await Promise.all(disposers.splice(0).map(dispose => dispose()))
    await Promise.all(temporaryDirectories.splice(0).map(dir => rm(dir, { recursive: true, force: true })))
  })

  it('surfaces a second save that lands within the throttle window', async () => {
    const { file, seen } = await createWatcher(true)

    await saveTwice(file)

    await expect.poll(() => seen.length, { timeout: 5000 }).toBeGreaterThanOrEqual(2)
  })

  it('surfaces a throttled second save for a watcher with a `cwd`', async () => {
    const { file, seen } = await createWatcher(true, true)

    await saveTwice(file)

    await expect.poll(() => seen.length, { timeout: 5000 }).toBeGreaterThanOrEqual(2)
  })

  it('does not duplicate or delay a single save', async () => {
    const { file, seen } = await createWatcher(true)

    await writeFile(file, '<template>1</template>')

    await expect.poll(() => seen.length, { timeout: 5000 }).toBe(1)
    await new Promise(resolve => setTimeout(resolve, 300))
    expect(seen).toHaveLength(1)
  })

  it('is not applied twice to the same watcher', async () => {
    const { file, seen, watcher } = await createWatcher(true)
    disposers.push(recoverThrottledChanges(watcher))

    await saveTwice(file)
    await expect.poll(() => seen.length, { timeout: 5000 }).toBeGreaterThanOrEqual(2)

    await new Promise(resolve => setTimeout(resolve, 300))
    expect(seen.length).toBeLessThanOrEqual(3)
  })

  it('stops re-emitting once disposed', async () => {
    const dir = await realpath(await mkdtemp(join(tmpdir(), 'nuxt-watch-')))
    temporaryDirectories.push(dir)
    const file = join(dir, 'component.vue')
    await writeFile(file, '0')

    const watcher = watch(dir, { ignoreInitial: true })
    disposers.push(() => watcher.close())
    const dispose = recoverThrottledChanges(watcher)

    const seen: string[] = []
    watcher.on('change', path => void (path === file && seen.push(path)))
    await new Promise<void>(resolve => watcher.on('ready', () => resolve()))

    await writeFile(file, '1')
    await expect.poll(() => seen.length, { timeout: 5000 }).toBe(1)

    dispose()
    await writeFile(file, '2')
    await new Promise(resolve => setTimeout(resolve, 500))
    expect(seen.length).toBeLessThanOrEqual(2)
  })
})
