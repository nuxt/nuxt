import { rm, writeFile } from 'node:fs/promises'
import { watch } from 'chokidar'
import { join } from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { recoverThrottledChanges } from '../src/watch.ts'
import { createTempDir } from './utils.ts'

const cleanup: Array<() => unknown> = []

async function createWatcher (cwd: boolean) {
  const dir = await createTempDir('nuxt-watch-')
  const file = join(dir, 'component.vue')
  await writeFile(file, '<template>0</template>')

  const watcher = cwd
    ? watch('component.vue', { cwd: dir, ignoreInitial: true })
    : watch(dir, { ignoreInitial: true })
  cleanup.push(recoverThrottledChanges(watcher), () => watcher.close(), () => rm(dir, { recursive: true, force: true }))

  const emitted = cwd ? 'component.vue' : file
  const seen: string[] = []
  watcher.on('change', (path) => {
    if (path === emitted) { seen.push(path) }
  })
  await new Promise<void>(resolve => watcher.on('ready', () => resolve()))

  return { file, seen }
}

describe('recoverThrottledChanges with chokidar', () => {
  afterEach(async () => {
    for (const dispose of cleanup.splice(0)) {
      await dispose()
    }
  })

  it.each([false, true])('surfaces a second save that lands within the throttle window (cwd: %s)', async (cwd) => {
    const { file, seen } = await createWatcher(cwd)

    await writeFile(file, '<template>1</template>')
    await new Promise(resolve => setTimeout(resolve, 25))
    await writeFile(file, '<template>2</template>')

    await expect.poll(() => seen.length, { timeout: 5000 }).toBeGreaterThanOrEqual(2)
  })

  it('does not duplicate or delay a single save', async () => {
    const { file, seen } = await createWatcher(false)

    await writeFile(file, '<template>1</template>')

    await expect.poll(() => seen.length, { timeout: 5000 }).toBe(1)
    await new Promise(resolve => setTimeout(resolve, 300))
    expect(seen).toHaveLength(1)
  })
})
