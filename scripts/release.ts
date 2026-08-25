/* eslint-disable no-console */
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { bumpNightly } from './bump-nightly.ts'

function execFile (file: string, args: string[], cwd?: string): void {
  console.info(`🔧 Running: ${file} ${args.join(' ')}`)
  execFileSync(file, args, { stdio: 'inherit', cwd })
}

const tag = (process.env.TAG || 'latest').trim()

const packagesToSkip = new Set(['nuxi', 'test-utils', 'ui-templates'])
const packageDirs = [
  ...readdirSync('packages', { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && !packagesToSkip.has(dirent.name))
    .map(dirent => `packages/${dirent.name}`),
  'docs',
]

async function main () {
  console.info(`🌙 Nightly release with tag: ${tag}`)

  console.info('🔄 Restoring git changes...')
  execFile('git', ['restore', '-s@', '-SW', '--', 'packages', 'examples', 'docs'])

  console.info('🌙 Bumping versions to nightly...')
  await bumpNightly()

  // The committed ui-templates output bakes in the nuxt package version,
  // so it must be regenerated after the nightly bump.
  execFile('vp', ['exec', 'pnpm', '--config.verify-deps-before-run=false', '--filter', '@nuxt/ui-templates', 'build'])

  for (const pkgDir of packageDirs) {
    console.info(`📦 Publishing ${pkgDir} with tag: ${tag}`)
    execFile('vp', ['exec', 'pnpm', 'publish', '--access', 'public', '--no-git-checks', '--tag', tag], pkgDir)
  }

  console.info('🎉 Nightly release completed successfully!')
}

main().catch((error) => {
  console.error('💥 Nightly release failed:', error)
  process.exit(1)
})
