import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import type { Frame } from 'my-bad'
import { setup } from '@nuxt/test-utils/e2e'

import { asyncContext, isDev, isTestingAppManifest, isWebpack, projectSuffix } from './matrix'
import { copyFixture, frameAt, renderErrorPage, sourcePosition } from './dev-error-utils'

const runs = isDev && !isWebpack && !asyncContext && isTestingAppManifest

const fixtureURL = runs
  ? copyFixture('dev-error-sourcemap', `dev-error-sourcemap-edits-${projectSuffix}`)
  : new URL('./fixtures/dev-error-sourcemap/', import.meta.url)

if (runs) {
  await setup({
    rootDir: fileURLToPath(fixtureURL),
    dev: true,
    server: true,
    browser: false,
    setupTimeout: 240 * 1000,
    serverStartTimeout: 240 * 1000,
  })
}

const PADDING = Array.from({ length: 6 }, (_, index) => `// padding ${index}`).join('\n') + '\n'

const originals = new Map<string, string>()

function read (file: string) {
  const path = fileURLToPath(new URL(file, fixtureURL))
  const contents = readFileSync(path, 'utf8').replaceAll('\r\n', '\n')
  if (!originals.has(path)) {
    originals.set(path, contents)
  }
  return { path, contents }
}

function write (file: string, contents: string) {
  const { path } = read(file)
  writeFileSync(path, contents)
}

/** Poll `path` until the report's frame for `file` sits at `line`, and return it. */
async function frameSettlesAt (path: string, file: string, line: number): Promise<Frame> {
  await expect.poll(async () => frameAt((await renderErrorPage(path)).report, file)?.line, { timeout: 15_000 }).toBe(line)
  return frameAt((await renderErrorPage(path)).report, file)!
}

function highlightedLine (frame: Frame): string | undefined {
  return frame.snippet?.lines[frame.line! - frame.snippet.start]
}

describe.skipIf(!runs)('dev ssr stack mapping across edits', () => {
  afterEach(() => {
    for (const [path, contents] of originals) {
      writeFileSync(path, contents)
    }
  })

  it('follows a composable as lines are added above the throw and taken away again', async () => {
    const { contents } = read('app/utils/boom.ts')
    const start = sourcePosition(fixtureURL, 'app/utils/boom.ts', 'new Error')

    const before = await frameSettlesAt('/', 'app/utils/boom.ts', start.line)
    expect(before.column).toBe(start.column)
    expect(highlightedLine(before)).toContain('throw new Error')

    write('app/utils/boom.ts', PADDING + contents)
    const shifted = await frameSettlesAt('/', 'app/utils/boom.ts', start.line + 6)
    expect(shifted.column).toBe(start.column)
    expect(highlightedLine(shifted)).toContain('throw new Error')

    write('app/utils/boom.ts', contents)
    const restored = await frameSettlesAt('/', 'app/utils/boom.ts', start.line)
    expect(restored.column).toBe(start.column)
    expect(highlightedLine(restored)).toContain('throw new Error')
  })

  it('follows a `<script setup>` block as lines are added above the throw and taken away again', async () => {
    const { contents } = read('app/pages/boom-page.vue')
    const start = sourcePosition(fixtureURL, 'app/pages/boom-page.vue', 'new Error')

    const before = await frameSettlesAt('/boom-page', 'app/pages/boom-page.vue', start.line)
    expect(before.column).toBe(start.column)
    expect(highlightedLine(before)).toContain('throw new Error')

    write('app/pages/boom-page.vue', contents.replace('throw new Error', PADDING + 'throw new Error'))
    const shifted = await frameSettlesAt('/boom-page', 'app/pages/boom-page.vue', start.line + 6)
    expect(shifted.column).toBe(start.column)
    expect(highlightedLine(shifted)).toContain('throw new Error')

    write('app/pages/boom-page.vue', contents)
    const restored = await frameSettlesAt('/boom-page', 'app/pages/boom-page.vue', start.line)
    expect(restored.column).toBe(start.column)
    expect(highlightedLine(restored)).toContain('throw new Error')
  })
})
