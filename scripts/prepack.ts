import process from 'node:process'
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '..')
const pkgDir = process.cwd()

copyFileSync(resolve(repoRoot, 'LICENSE'), resolve(pkgDir, 'LICENSE'))

// `docs` ships its own markdown and has no README of its own to overwrite
if (basename(pkgDir) !== 'docs') {
  // absolute URLs render on npm, relative ones do not
  const readme = readFileSync(resolve(repoRoot, 'README.md'), 'utf-8')
    .replace(/\.\/\.github\/assets/g, 'https://github.com/nuxt/nuxt/blob/main/.github/assets')
  writeFileSync(resolve(pkgDir, 'README.md'), readme)
}
