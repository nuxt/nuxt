/**
 * Backport a commit from `main`.
 *
 * `packages/nitro-v3-server` and `packages/kit/src` mirror `main` as a whole, so a commit that
 * touches them cannot be cherry-picked: the mirror is moved forward to that commit with
 * `sync-nitro-v3-server.ts`, and the rest of the commit is cherry-picked. The lockfile is
 * never taken from `main`.
 *
 * Usage: node scripts/backport.ts <commit on main>
 */
import process from 'node:process'
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const MIRRORED = ['packages/nitro-server', 'packages/kit/src']
const REF_FILE = 'packages/nitro-v3-server/.main-ref'
const NOT_APPLIED = [...MIRRORED, 'pnpm-lock.yaml']

const repoRoot = resolve(import.meta.dirname, '..')
const log = (message: string) => process.stdout.write(`${message}\n`)
const git = (...command: string[]) => execFileSync('git', command, { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim()
const succeeds = (...command: string[]) => spawnSync('git', command, { cwd: repoRoot, stdio: 'ignore' }).status === 0

const requested = process.argv[2]
if (!requested) {
  throw new Error('Usage: node scripts/backport.ts <commit on main>')
}
if (git('status', '--porcelain')) {
  throw new Error('The working tree has changes. Commit or discard them first.')
}
if (!succeeds('cat-file', '-e', `${requested}^{commit}`)) {
  git('fetch', 'origin', requested)
}
const commit = git('rev-parse', requested)
const subject = git('log', '-1', '--format=%s', commit)

spawnSync('git', ['cherry-pick', '--no-commit', commit], { cwd: repoRoot, stdio: 'inherit' })
git('restore', '--source=HEAD', '--staged', '--worktree', '--', ...NOT_APPLIED)

const mirrored = git('diff', '--name-only', `${commit}^`, commit, '--', ...MIRRORED)
const recorded = readFileSync(resolve(repoRoot, REF_FILE), 'utf8').trim()
if (mirrored && !succeeds('merge-base', '--is-ancestor', commit, recorded)) {
  const others = git('log', '--format=%h %s', `${recorded}..${commit}^`, '--', ...MIRRORED)
  execFileSync('node', ['scripts/sync-nitro-v3-server.ts', commit], { cwd: repoRoot, stdio: 'inherit' })
  if (others) {
    log(`Mirrored with it, from earlier commits on main:\n${others.split('\n').map(line => `  ${line}`).join('\n')}`)
  }
}

git('add', '--', 'packages/nitro-v3-server', 'packages/kit/src')
const conflicted = !!git('diff', '--name-only', '--diff-filter=U')
const changed = !!git('status', '--porcelain')
if (conflicted) {
  log(`\nParts of "${subject}" did not apply. Resolve them, stage the result, then run:\n  git commit -C ${commit.slice(0, 10)}`)
  process.exitCode = 1
} else if (!changed) {
  log(`Nothing to backport: 4.x already has "${subject}".`)
} else {
  execFileSync('git', ['commit', '-C', commit], { cwd: repoRoot, stdio: 'inherit' })
}
if (changed && git('diff', '--name-only', `${commit}^`, commit, '--', 'pnpm-lock.yaml', '*package.json', 'pnpm-workspace.yaml')) {
  log('\nThis commit changes dependencies on main. The lockfile was not applied: check the manifests and run `pnpm install`.')
}
