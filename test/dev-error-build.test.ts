import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { glob } from 'tinyglobby'
import { readFile } from 'node:fs/promises'
import { fetch, useTestContext } from '@nuxt/test-utils/e2e'

import { isBuilt, legacyErrorRendering, runsOncePerViteBuilderInMatrix } from './matrix'
import { fixturePath, setupFixture } from './utils'

const rootDir = fixturePath('dev-error-client')
const repoDir = fileURLToPath(new URL('../', import.meta.url))

const runs = isBuilt && (runsOncePerViteBuilderInMatrix || legacyErrorRendering)

await setupFixture('dev-error-client', runs)

const relativeRootDir = rootDir.slice(repoDir.length)

const forwardSlashes = (path: string) => path.replaceAll('\\\\', '/').replaceAll('\\', '/')

/**
 * Paths baked into the bundle name the fixture and the checkout, both of which contain
 * `dev-error`. A windows path is baked in escaped or forward-slashed depending on who
 * wrote it, so both sides are compared with forward slashes.
 */
function withoutPaths (contents: string) {
  let stripped = forwardSlashes(contents)
  for (const path of [rootDir, repoDir, relativeRootDir]) {
    stripped = stripped.replaceAll(forwardSlashes(path), '')
  }
  return stripped
}

describe.skipIf(!runs)('development error reporting in a production build', () => {
  it('leaves no trace of the overlay, the reporter or the channel in the output', async () => {
    const outputDir = useTestContext().nuxt!.options.nitro.output!.dir!
    const files = await glob(['**/*.{mjs,js,cjs,json,html,css}'], { cwd: outputDir, absolute: true })

    expect(files.length).toBeGreaterThan(0)
    const offenders: string[] = []
    for (const file of files) {
      const contents = withoutPaths(await readFile(file, 'utf8'))
      for (const needle of ['my-bad', 'dev-error', 'error-channel']) {
        if (contents.includes(needle)) {
          offenders.push(`${file.slice(outputDir.length + 1)}: ${needle}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it('does not serve the live error channel', async () => {
    const res = await fetch('/__nuxt_dev__/error/events', { headers: { accept: 'text/event-stream' } })
    await res.body?.cancel()

    expect(res.status).toBe(404)
  })
})
