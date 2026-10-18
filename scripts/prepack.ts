import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const pkgDir = process.cwd()
const pkgPath = resolve(pkgDir, 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))

if (basename(pkgDir) === 'nuxt' && pkg.name === 'nuxt-nightly') {
  execFileSync('pnpm', ['--config.verify-deps-before-run=false', '--filter', '@nuxt/ui-templates', 'build'], {
    cwd: repoRoot,
    stdio: 'inherit',
  })

  // the runtime imports `nuxt/internal/*`, which cannot self-reference under the `nuxt-nightly` name
  pkg.peerDependencies = { ...pkg.peerDependencies, nuxt: `npm:nuxt-nightly@${pkg.version}` }
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
}

copyFileSync(resolve(repoRoot, 'LICENSE'), resolve(pkgDir, 'LICENSE'))

// `docs` ships its own markdown and has no README of its own to overwrite
if (basename(pkgDir) !== 'docs') {
  // absolute URLs render on npm, relative ones do not
  const readme = readFileSync(resolve(repoRoot, 'README.md'), 'utf-8')
    .replace(/\.\/\.github\/assets/g, 'https://github.com/nuxt/nuxt/blob/main/.github/assets')
  writeFileSync(resolve(pkgDir, 'README.md'), readme)
}
