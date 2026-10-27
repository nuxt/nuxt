import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { formatBytes, formatDelta, markdownTable } from '../lib/stats.ts'
import type { SuiteContext, SuiteResult } from '../lib/suite.ts'
import type { Target } from '../lib/targets.ts'

interface Footprint {
  packages: number
  files: number
  bytes: number
  tarballs?: number
}

function measure (target: Target): Footprint {
  let packages = 0
  let files = 0
  let bytes = 0
  const walk = (dir: string, isModulesDir: boolean) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isFile()) {
        files++
        bytes += statSync(path).size
      } else if (entry.isDirectory()) {
        if (isModulesDir && !entry.name.startsWith('@') && !entry.name.startsWith('.') && existsSync(join(path, 'package.json'))) {
          packages++
        }
        walk(path, entry.name === 'node_modules' || (isModulesDir && entry.name.startsWith('@')))
      }
    }
  }
  walk(join(target.dir, 'node_modules'), true)
  const tarballs = Object.values(target.tarballs)
  return { packages, files, bytes, tarballs: tarballs.length ? tarballs.reduce((total, path) => total + statSync(path).size, 0) : undefined }
}

export function footprintSuite ({ targets, log }: SuiteContext): Promise<SuiteResult> {
  log('footprint')
  const [baseline, head] = targets.map(measure) as [Footprint, Footprint]
  const row = (label: string, a: number | undefined, b: number | undefined, format: (n: number) => string = String) =>
    [label, a === undefined ? 'n/a' : format(a), b === undefined ? 'n/a' : format(b), a === undefined || b === undefined ? 'n/a' : formatDelta(a, b)]

  const markdown = [
    'Fresh `npm install` of `nuxt` into an empty project. Tarball size is the sum of the packed workspace packages.',
    '',
    markdownTable(['Metric', 'baseline', 'head', 'delta'], [
      row('installed packages', baseline.packages, head.packages),
      row('`node_modules` files', baseline.files, head.files),
      row('`node_modules` size', baseline.bytes, head.bytes, formatBytes),
      row('packed tarballs', baseline.tarballs, head.tarballs, formatBytes),
    ]),
  ].join('\n')

  return Promise.resolve({
    markdown,
    headline: [
      row('installed packages', baseline.packages, head.packages),
      row('`node_modules` size', baseline.bytes, head.bytes, formatBytes),
    ],
    data: { baseline, head },
  })
}
