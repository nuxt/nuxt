/* eslint-disable no-console */
import process from 'node:process'
import { execSync } from 'node:child_process'
import { copyFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

interface PackageJson {
  name: string
  version: string
}

function execCommand (command: string, cwd?: string): void {
  console.info(`🔧 Running: ${command}`)
  execSync(command, { stdio: 'inherit', cwd })
}

function readPackageJson (dir: string): PackageJson {
  const pkgPath = resolve(dir, 'package.json')
  return JSON.parse(readFileSync(pkgPath, 'utf-8'))
}

async function main () {
  const originalCwd = process.cwd()
  const isNightly = process.argv.includes('--nightly')
  const tagsInput = process.env.TAG || 'latest'
  const allTags = tagsInput
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean)

  console.info(`🚀 ${isNightly ? 'Nightly' : 'Regular'} release with tags: ${allTags.join(', ')}`)

  const [tag, ...additionalTags] = allTags

  try {
    // Restore all git changes
    console.info('🔄 Restoring git changes...')
    execCommand('git restore -s@ -SW -- packages examples docs')

    if (isNightly) {
      // Bump versions to nightly
      console.info('🌙 Bumping versions to nightly...')
      await import('./bump-nightly.ts').then(r => r.bumpNightly())
    } else {
      execCommand('pnpm build')
    }

    // Use absolute URLs for better rendering on npm
    console.info('🔗 Updating README URLs...')
    const originalReadme = readFileSync('README.md', 'utf-8')
    const readme = originalReadme.replace(
      /\.\/\.github\/assets/g,
      'https://github.com/nuxt/nuxt/blob/main/.github/assets',
    )
    writeFileSync('README.md', readme)

    const repoRoot = resolve(import.meta.dirname, '..')

    // Get all package directories
    const packageDirs = [
      ...readdirSync('packages', { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => `packages/${dirent.name}`),
      'docs',
    ]

    // Release packages
    const packagesToSkip = ['packages/nuxi', 'packages/test-utils', 'packages/ui-templates']
    for (const pkgDir of packageDirs) {
      if (packagesToSkip.includes(pkgDir)) {
        continue
      }

      console.info(`📦 Publishing ${pkgDir}`)
      process.chdir(pkgDir)

      // Copy LICENSE
      copyFileSync(resolve(repoRoot, 'LICENSE'), 'LICENSE')

      // Copy README if not docs
      if (pkgDir !== 'docs') {
        copyFileSync(resolve(repoRoot, 'README.md'), 'README.md')
      }

      // Publish with first tag, then add additional tags
      console.info(`🏷️ Publishing ${pkgDir} with tag: ${tag}`)
      execCommand(`pnpm publish --access public --no-git-checks --tag ${tag}`)

      // Add additional tags if there are more than one
      const pkg = readPackageJson('.')
      for (const additionalTag of additionalTags) {
        console.info(`🏷️ Adding tag ${additionalTag} to ${pkg.name}@${pkg.version}`)
        try {
          execCommand(`npm dist-tag add "${pkg.name}@${pkg.version}" ${additionalTag}`)
        } catch (error) {
          console.error(`❌ Failed to add tag ${additionalTag} to ${pkg.name}@${pkg.version}:`, error)
          throw error
        }
      }

      process.chdir(repoRoot)
    }

    // Restore README
    writeFileSync('README.md', originalReadme)

    console.info(`🎉 ${isNightly ? 'Nightly' : 'Regular'} release completed successfully!`)
  } catch (error) {
    console.error('💥 Release failed:', error)
    process.exit(1)
  } finally {
    process.chdir(originalCwd)
  }
}

main()
