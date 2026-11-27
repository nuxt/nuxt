/**
 * Mirror the Nitro v3 server builder and the kit source from `main`: `packages/nitro-server`
 * into `packages/nitro-v3-server` (everything but `package.json`), and `packages/kit/src` as
 * is. The commit they were taken from is recorded in `packages/nitro-v3-server/.main-ref`.
 *
 * Commits listed in `packages/nitro-v3-server/.main-deferred` (one sha per line, oldest first,
 * `#` starts a comment) are reverted from the mirrored files, so a change on `main` can be held
 * back from 4.x while the mirror moves past it. Each must be an ancestor of the recorded commit.
 *
 * Usage:
 *   node scripts/sync-nitro-v3-server.ts [ref]          copy from `ref` (default `origin/main`) and record it
 *   node scripts/sync-nitro-v3-server.ts --check        compare with the recorded commit
 *   node scripts/sync-nitro-v3-server.ts <ref> --check  compare with `ref`
 */
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'

interface Mirror {
  source: string
  target: string
  /** Files of the target that are not taken from the source. */
  kept: Set<string>
}

const BUILDER = 'packages/nitro-v3-server'
const REF_FILE = '.main-ref'
const DEFERRED_FILE = '.main-deferred'
const MIRRORS: Mirror[] = [
  { source: 'packages/nitro-server', target: BUILDER, kept: new Set(['package.json', REF_FILE, DEFERRED_FILE]) },
  { source: 'packages/kit/src', target: 'packages/kit/src', kept: new Set() },
]
const IGNORED = new Set(['node_modules', 'dist', 'LICENSE', 'README.md'])

const repoRoot = resolve(import.meta.dirname, '..')
const refFile = resolve(repoRoot, BUILDER, REF_FILE)
const args = process.argv.slice(2)
const check = args.includes('--check')
const requested = args.find(arg => !arg.startsWith('--'))

const log = (message: string) => process.stdout.write(`${message}\n`)
const git = (...command: string[]) => execFileSync('git', command, { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })

function resolveRef (): string {
  if (requested) { return requested }
  if (!check) { return 'origin/main' }
  if (!existsSync(refFile)) {
    throw new Error(`No commit is recorded in ${BUILDER}/${REF_FILE}. Run this script without \`--check\` first.`)
  }
  const recorded = readFileSync(refFile, 'utf8').trim()
  ensureCommit(recorded, 1)
  return recorded
}

function ensureCommit (sha: string, depth: number) {
  try {
    git('cat-file', '-e', `${sha}~${depth - 1}^{commit}`)
  } catch {
    git('fetch', `--depth=${depth}`, 'origin', sha)
  }
}

function readDeferred (): string[] {
  const file = resolve(repoRoot, BUILDER, DEFERRED_FILE)
  if (!existsSync(file)) { return [] }
  return readFileSync(file, 'utf8').split('\n').map(line => line.replace(/#.*$/, '').trim().split(/\s+/)[0]!).filter(Boolean)
}

/** The mirrored files the deferred commits touch, as they are at `ref` with those commits reverted (`null` when reverting removes the file). */
function revertDeferred (ref: string): Map<string, Buffer | null> {
  const reverted = new Map<string, Buffer | null>()
  const deferred = readDeferred()
  if (!deferred.length) { return reverted }

  const sources = MIRRORS.map(entry => entry.source)
  const dir = mkdtempSync(join(tmpdir(), 'nitro-v3-deferred-'))
  try {
    const patches = deferred.map((sha) => {
      ensureCommit(sha, 2)
      const paths = git('diff', '--name-only', '--no-renames', `${sha}^`, sha, '--', ...sources).toString().split('\n').filter(Boolean)
      return { sha, paths, patch: git('diff', '--binary', '--no-renames', `${sha}^`, sha, '--', ...sources) }
    })
    const paths = new Set(patches.flatMap(entry => entry.paths))
    for (const path of paths) {
      try {
        const contents = git('show', `${ref}:${path}`)
        mkdirSync(dirname(join(dir, path)), { recursive: true })
        writeFileSync(join(dir, path), contents)
      } catch {
        // added by a deferred commit and removed again since; reverting the patch reports it
      }
    }
    for (const { sha, paths, patch } of patches.reverse()) {
      if (!paths.length) { continue }
      try {
        execFileSync('git', ['apply', '--reverse', '--binary', '-'], { cwd: dir, input: patch, stdio: ['pipe', 'pipe', 'pipe'] })
      } catch (error) {
        throw new Error(`${sha.slice(0, 10)} in ${BUILDER}/${DEFERRED_FILE} no longer reverts cleanly at ${ref}. Backport it, or move it after the commits that build on it.\n${(error as { stderr?: Buffer }).stderr?.toString() ?? error}`, { cause: error })
      }
      log(`Deferred ${git('log', '-1', '--format=%h %s', sha).toString().trim()}`)
    }
    for (const path of paths) {
      reverted.set(path, existsSync(join(dir, path)) ? readFileSync(join(dir, path)) : null)
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  return reverted
}

function listFiles (dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (IGNORED.has(name)) { return [] }
    const path = join(dir, name)
    return statSync(path).isDirectory() ? listFiles(path, root) : [relative(root, path).replace(/\\/g, '/')]
  })
}

function mirror ({ source, target, kept }: Mirror, ref: string, reverted: Map<string, Buffer | null>): { changed: string[], removed: string[] } {
  const files = new Set(git('ls-tree', '-r', '--name-only', ref, source).toString().split('\n').filter(Boolean))
  for (const [path, contents] of reverted) {
    if (!path.startsWith(`${source}/`)) { continue }
    if (contents) { files.add(path) } else { files.delete(path) }
  }
  const sourceFiles = [...files]
    .map(path => path.slice(source.length + 1))
    .filter(path => !kept.has(path))

  const changed: string[] = []
  for (const path of sourceFiles) {
    const contents = reverted.get(`${source}/${path}`) ?? git('show', `${ref}:${source}/${path}`)
    const file = resolve(repoRoot, target, path)
    if (existsSync(file) && readFileSync(file).equals(contents)) { continue }
    changed.push(path)
    if (!check) {
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, contents)
    }
  }

  const expected = new Set(sourceFiles)
  const removed = listFiles(resolve(repoRoot, target)).filter(path => !kept.has(path) && !expected.has(path))
  if (!check) {
    for (const path of removed) {
      rmSync(resolve(repoRoot, target, path))
    }
  }
  return { changed, removed }
}

const ref = resolveRef()
const commit = git('rev-parse', ref).toString().trim()
const reverted = revertDeferred(commit)

let drift = 0
for (const entry of MIRRORS) {
  const { changed, removed } = mirror(entry, ref, reverted)
  drift += changed.length + removed.length
  log(`${check ? 'Compared with' : 'Synced from'} ${entry.source} at ${commit.slice(0, 10)}: ${changed.length} changed, ${removed.length} removed.`)
  for (const path of changed) { log(`  changed  ${path}`) }
  for (const path of removed) { log(`  removed  ${path}`) }
}

const sourcePackage = JSON.parse(git('show', `${ref}:${MIRRORS[0]!.source}/package.json`).toString())
const targetPackage = JSON.parse(readFileSync(resolve(repoRoot, BUILDER, 'package.json'), 'utf8'))
const names = (pkg: Record<string, Record<string, string> | undefined>) => new Set(['dependencies', 'peerDependencies', 'devDependencies'].flatMap(field => Object.keys(pkg[field] || {})))
const sourceNames = names(sourcePackage)
const targetNames = names(targetPackage)
const missing = [...sourceNames].filter(name => !targetNames.has(name))
const extra = [...targetNames].filter(name => !sourceNames.has(name))
if (missing.length || extra.length) {
  log(`Dependencies differ in ${BUILDER}/package.json:`)
  for (const name of missing) { log(`  missing  ${name}`) }
  for (const name of extra) { log(`  extra    ${name}`) }
}

if (!check) {
  writeFileSync(refFile, `${commit}\n`)
} else if (drift) {
  process.exitCode = 1
}
