/**
 * Mirror the Nitro v3 server builder and the kit source from `main`: `packages/nitro-server`
 * into `packages/nitro-v3-server` (everything but `package.json`), and `packages/kit/src` as
 * is. The commit they were taken from is recorded in `packages/nitro-v3-server/.main-ref`.
 *
 * Usage:
 *   node scripts/sync-nitro-v3-server.ts [ref]          copy from `ref` (default `origin/main`) and record it
 *   node scripts/sync-nitro-v3-server.ts --check        compare with the recorded commit
 *   node scripts/sync-nitro-v3-server.ts <ref> --check  compare with `ref`
 */
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

interface Mirror {
  source: string
  target: string
  /** Files of the target that are not taken from the source. */
  kept: Set<string>
}

const BUILDER = 'packages/nitro-v3-server'
const REF_FILE = '.main-ref'
const MIRRORS: Mirror[] = [
  { source: 'packages/nitro-server', target: BUILDER, kept: new Set(['package.json', REF_FILE]) },
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
  try {
    git('cat-file', '-e', `${recorded}^{commit}`)
  } catch {
    git('fetch', '--depth=1', 'origin', recorded)
  }
  return recorded
}

function listFiles (dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (IGNORED.has(name)) { return [] }
    const path = join(dir, name)
    return statSync(path).isDirectory() ? listFiles(path, root) : [relative(root, path).replace(/\\/g, '/')]
  })
}

function mirror ({ source, target, kept }: Mirror, ref: string): { changed: string[], removed: string[] } {
  const sourceFiles = git('ls-tree', '-r', '--name-only', ref, source).toString().split('\n').filter(Boolean)
    .map(path => path.slice(source.length + 1))
    .filter(path => !kept.has(path))

  const changed: string[] = []
  for (const path of sourceFiles) {
    const contents = git('show', `${ref}:${source}/${path}`)
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

let drift = 0
for (const entry of MIRRORS) {
  const { changed, removed } = mirror(entry, ref)
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
