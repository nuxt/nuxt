import { execSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

function collectTargets (value: unknown, targets: Set<string> = new Set()): Set<string> {
  if (typeof value === 'string') {
    targets.add(value)
  } else if (value && typeof value === 'object') {
    for (const child of Object.values(value)) {
      collectTargets(child, targets)
    }
  }
  return targets
}

// this is a workaround for the fact that `attw --pack` uses `npm pack`
// which does not apply `publishConfig.exports`.
const packDir = mkdtempSync(join(tmpdir(), 'nuxt-attw-'))
try {
  execSync(`pnpm pack --pack-destination ${packDir}`, { stdio: 'inherit' })
  const tarball = readdirSync(packDir).find(f => f.endsWith('.tgz'))
  if (!tarball) {
    console.error('[test-attw] pnpm pack did not produce a tarball')
    process.exit(1)
  }

  execSync(`tar -xzf ${join(packDir, tarball)} -C ${packDir}`)
  const pkgRoot = join(packDir, 'package')
  const pkg = JSON.parse(readFileSync(join(pkgRoot, 'package.json'), 'utf-8'))
  const missing = [...collectTargets([pkg.exports, pkg.imports])]
    .filter(target => target.startsWith('./') && !target.includes('*') && !existsSync(join(pkgRoot, target)))
  if (missing.length) {
    console.error(`[test-attw] ${pkg.name} tarball is missing files referenced in \`exports\`/\`imports\`:\n${missing.map(t => `  - ${t}`).join('\n')}`)
    process.exitCode = 1
  } else {
    execSync(`pnpm exec attw ${join(packDir, tarball)}`, { stdio: 'inherit' })
  }
} finally {
  rmSync(packDir, { recursive: true, force: true })
}
