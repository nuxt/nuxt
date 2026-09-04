import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { exec } from 'tinyexec'
import { glob } from 'tinyglobby'
import { join, relative } from 'pathe'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const runner = fileURLToPath(new URL('./run-without-jiti.mjs', import.meta.url))

const kitSource = join(repoRoot, 'packages/kit/src/index.ts')
const kitDist = join(repoRoot, 'packages/kit/dist/index.mjs')

/** Packages allowed to declare `jiti`, and only as an optional peer dependency. */
const OPTIONAL_JITI_PACKAGES = new Set(['@nuxt/kit'])

/**
 * `nuxt` still ships `jiti` on this branch so that projects relying on it keep working; the
 * loading paths below must nevertheless survive without it.
 */
const HARD_JITI_PACKAGES = new Set(['nuxt'])

async function runWithoutJiti (kitEntry: string, task: 'config' | 'build', cwds: string[]) {
  const { stdout, stderr, exitCode } = await exec(process.execPath, [runner, kitEntry, task, ...cwds], {
    nodeOptions: { cwd: repoRoot },
  })
  // the child reports `ok <cwd>` per success, so a failure can be attributed to the fixture
  // that caused it rather than just to the run as a whole
  const completed = stdout.split('\n').filter(line => line.startsWith('ok ')).map(line => line.slice(3))
  const failedOn = cwds.find(cwd => !completed.includes(cwd))
  return {
    exitCode,
    completed,
    /** Message describing where and why the child stopped, for use as an assertion message. */
    report: [
      failedOn && `failed on ${relative(repoRoot, failedOn)} (${completed.length}/${cwds.length} succeeded)`,
      stderr.trim().split('\n').slice(-40).join('\n'),
    ].filter(Boolean).join('\n\n'),
  }
}

async function fixtureDirs () {
  const configs = await glob(['test/fixtures/*/nuxt.config.ts', 'playground/nuxt.config.ts'], { cwd: repoRoot, absolute: true })
  return configs.map(config => join(config, '..')).sort()
}

describe('jiti is not required', () => {
  it('is not a hard dependency of any package other than `nuxt`', async () => {
    const manifests = await glob('packages/*/package.json', { cwd: repoRoot, absolute: true })
    expect(manifests.length).toBeGreaterThan(0)

    const offenders: string[] = []
    for (const manifest of manifests) {
      const pkg = JSON.parse(await readFile(manifest, 'utf8')) as {
        name: string
        private?: boolean
        dependencies?: Record<string, string>
        peerDependencies?: Record<string, string>
        peerDependenciesMeta?: Record<string, { optional?: boolean }>
      }
      if (pkg.private) { continue }

      if (pkg.dependencies?.jiti && !HARD_JITI_PACKAGES.has(pkg.name)) {
        offenders.push(`${pkg.name} lists jiti in dependencies`)
      }
      if (pkg.peerDependencies?.jiti) {
        if (!OPTIONAL_JITI_PACKAGES.has(pkg.name)) {
          offenders.push(`${pkg.name} should not declare jiti at all`)
        } else if (!pkg.peerDependenciesMeta?.jiti?.optional) {
          offenders.push(`${pkg.name} declares jiti as a required peer dependency`)
        }
      }
    }

    expect(offenders).toEqual([])
  })

  it.skipIf(!existsSync(kitDist))('does not statically import jiti from the built kit', async () => {
    const dist = await readFile(kitDist, 'utf8')
    expect(dist).not.toMatch(/^import[^\n]*['"]jiti['"]/m)
    // the fallback is still expected, as a lazy import
    expect(dist).toMatch(/import\(['"]jiti['"]\)/)
  })

  it('loads the config of every fixture', async () => {
    const dirs = await fixtureDirs()
    expect(dirs.length).toBeGreaterThan(10)

    const { exitCode, completed, report } = await runWithoutJiti(kitSource, 'config', dirs)
    expect(exitCode, report).toBe(0)
    expect(completed).toEqual(dirs)
  }, 120_000)

  it.skipIf(!existsSync(kitDist))('loads the config of every fixture from the built kit', async () => {
    const dirs = await fixtureDirs()
    const { exitCode, completed, report } = await runWithoutJiti(kitDist, 'config', dirs)
    expect(exitCode, report).toBe(0)
    expect(completed).toEqual(dirs)
  }, 120_000)

  it.skipIf(process.env.SKIP_NO_JITI_BUILD === 'true')('builds a minimal application', async () => {
    const cwd = join(repoRoot, 'test/fixtures/minimal')
    const { exitCode, report } = await runWithoutJiti(kitSource, 'build', [cwd])
    expect(exitCode, report).toBe(0)
  }, 300_000)
})
