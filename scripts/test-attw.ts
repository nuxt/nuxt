import { execSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'

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
  execSync(`pnpm exec attw ${join(packDir, tarball)}`, { stdio: 'inherit' })
} finally {
  rmSync(packDir, { recursive: true, force: true })
}
