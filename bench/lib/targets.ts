import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { run } from './proc.ts'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

export interface Target {
  id: 'baseline' | 'head'
  /** `head`, `ref:<git-ref>` or an npm version, tag or alias for `nuxt`. */
  spec: string
  /** Short commit hash or resolved `nuxt` version. */
  version: string
  /** Install directory, holding `node_modules` and one subdirectory per fixture. */
  dir: string
  /** Packed tarballs, keyed by package name. Empty for npm specs. */
  tarballs: Record<string, string>
  bin: string
}

interface PrepareTargetOptions {
  workdir: string
  log: (message: string) => void
}

export async function prepareTarget (id: Target['id'], spec: string, options: PrepareTargetOptions): Promise<Target> {
  const dir = join(options.workdir, id)
  const packDir = join(options.workdir, `${id}-packs`)
  rmSync(dir, { recursive: true, force: true })
  rmSync(packDir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })

  let version: string
  let tarballs: Record<string, string> = {}
  if (spec === 'head' || spec.startsWith('ref:')) {
    const source = spec === 'head' ? repoRoot : await checkoutRef(spec.slice(4), options)
    version = git(['rev-parse', '--short', spec === 'head' ? 'HEAD' : spec.slice(4)])
    options.log(`packing ${id} (${version})`)
    tarballs = await packWorkspace(source, packDir)
  } else {
    version = spec
  }

  const nuxtSpec = tarballs.nuxt ? `file:${tarballs.nuxt}` : spec
  const overrides = Object.fromEntries(Object.entries(tarballs).filter(([name]) => name !== 'nuxt').map(([name, file]) => [name, `file:${file}`]))
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: `nuxt-bench-${id}`,
    private: true,
    type: 'module',
    dependencies: { nuxt: nuxtSpec },
    overrides,
  }, null, 2))

  options.log(`installing ${id}`)
  await run('npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: dir, timeout: 600_000 })

  if (!tarballs.nuxt) {
    version = JSON.parse(readFileSync(join(dir, 'node_modules/nuxt/package.json'), 'utf8')).version
  }

  return { id, spec, version, dir, tarballs, bin: join(dir, 'node_modules/nuxt/bin/nuxt.mjs') }
}

function git (args: string[], cwd = repoRoot): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

async function checkoutRef (ref: string, options: PrepareTargetOptions): Promise<string> {
  const sha = git(['rev-parse', '--verify', `${ref}^{commit}`])
  const source = join(options.workdir, 'src', sha)
  if (existsSync(join(source, '.bench-ready'))) {
    return source
  }
  options.log(`checking out ${ref} (${sha.slice(0, 10)})`)
  rmSync(source, { recursive: true, force: true })
  mkdirSync(source, { recursive: true })
  const archive = join(options.workdir, 'src', `${sha}.tar`)
  git(['archive', '--format=tar', `--output=${archive}`, sha])
  execFileSync('tar', ['-xf', archive, '-C', source])
  rmSync(archive)
  options.log(`installing ${ref} workspace`)
  await run('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts', '--config.verify-deps-before-run=false'], { cwd: source, timeout: 900_000, env: { CI: '1' } })
  writeFileSync(join(source, '.bench-ready'), '')
  return source
}

/** Packs `nuxt` and every workspace package it depends on, directly or transitively. */
async function packWorkspace (source: string, destination: string): Promise<Record<string, string>> {
  const packages = new Map<string, { dir: string, version: string, dependencies: string[] }>()
  for (const entry of readdirSync(join(source, 'packages'))) {
    const manifest = join(source, 'packages', entry, 'package.json')
    if (!existsSync(manifest)) {
      continue
    }
    const pkg = JSON.parse(readFileSync(manifest, 'utf8'))
    if (!pkg.private) {
      packages.set(pkg.name, { dir: join(source, 'packages', entry), version: pkg.version, dependencies: Object.keys(pkg.dependencies ?? {}) })
    }
  }

  const queue = ['nuxt']
  const needed = new Set<string>()
  while (queue.length) {
    const name = queue.shift()!
    if (needed.has(name) || !packages.has(name)) {
      continue
    }
    needed.add(name)
    queue.push(...packages.get(name)!.dependencies)
  }

  mkdirSync(destination, { recursive: true })
  const tarballs: Record<string, string> = {}
  for (const name of needed) {
    const pkg = packages.get(name)!
    await run('pnpm', ['--config.verify-deps-before-run=false', 'pack', '--pack-destination', destination], { cwd: pkg.dir, timeout: 600_000 })
    tarballs[name] = resolve(destination, `${name.replace(/^@/, '').replace('/', '-')}-${pkg.version}.tgz`)
    if (!existsSync(tarballs[name])) {
      throw new Error(`expected \`pnpm pack\` to write ${tarballs[name]}`)
    }
  }
  return tarballs
}

export function clearBuildCache (dir: string, { output = true } = {}): void {
  for (const path of ['.nuxt', 'node_modules/.cache', ...output ? ['.output', '.data'] : []]) {
    rmSync(join(dir, path), { recursive: true, force: true })
  }
}
