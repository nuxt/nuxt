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

/**
 * Exchange a GitHub Actions OIDC token for a short-lived npm registry token.
 *
 * This replicates what `npm publish` does internally with trusted publishing:
 * 1. Request a GitHub OIDC id_token with audience "npm:registry.npmjs.org"
 * 2. Exchange it with npm's OIDC endpoint for a scoped registry token
 */
async function getOidcToken (packageName: string): Promise<string> {
  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN

  if (!requestUrl || !requestToken) {
    throw new Error('GitHub Actions OIDC environment not available (ACTIONS_ID_TOKEN_REQUEST_URL/TOKEN not set)')
  }

  // Step 1: Request GitHub OIDC id_token with npm audience
  const idTokenUrl = `${requestUrl}&audience=${encodeURIComponent('npm:registry.npmjs.org')}`
  const idTokenResponse = await fetch(idTokenUrl, {
    headers: { authorization: `Bearer ${requestToken}` },
  })
  if (!idTokenResponse.ok) {
    throw new Error(`Failed to get GitHub OIDC token: ${idTokenResponse.status} ${idTokenResponse.statusText}`)
  }
  const { value: idToken } = await idTokenResponse.json() as { value: string }

  // Step 2: Exchange with npm registry for a short-lived publish token
  const encodedName = packageName.replace('/', '%2f')
  const exchangeUrl = `https://registry.npmjs.org/-/npm/v1/oidc/token/exchange/package/${encodedName}`
  const exchangeResponse = await fetch(exchangeUrl, {
    method: 'POST',
    headers: { authorization: `Bearer ${idToken}` },
  })
  if (!exchangeResponse.ok) {
    const body = await exchangeResponse.text()
    throw new Error(`Failed to exchange OIDC token for npm token (${packageName}): ${exchangeResponse.status} ${exchangeResponse.statusText} - ${body}`)
  }
  const { token } = await exchangeResponse.json() as { token: string }
  return token
}

/**
 * Add a dist-tag to a package using the npm registry HTTP API.
 *
 * With trusted publishing (OIDC), only `npm publish` can authenticate via OIDC
 * internally. Other commands like `npm dist-tag` cannot. This function obtains
 * an npm token via the OIDC exchange and calls the registry dist-tags API directly.
 */
async function addDistTag (packageName: string, version: string, tag: string): Promise<void> {
  const token = await getOidcToken(packageName)
  const encodedName = packageName.replace('/', '%2f')
  const url = `https://registry.npmjs.org/-/package/${encodedName}/dist-tags/${encodeURIComponent(tag)}`

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'authorization': `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(version),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Failed to add dist-tag ${tag} to ${packageName}@${version}: ${response.status} ${response.statusText} - ${body}`)
  }
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
    const published: Array<{ name: string, version: string }> = []

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

      // Publish with primary tag with trusted publishing
      console.info(`🏷️ Publishing ${pkgDir} with tag: ${tag}`)
      execCommand(`pnpm publish --access public --no-git-checks --tag ${tag}`)

      const pkg = readPackageJson('.')
      published.push({ name: pkg.name, version: pkg.version })

      process.chdir(repoRoot)
    }

    if (additionalTags.length > 0) {
      console.info(`\n🏷️ Adding additional dist-tags: ${additionalTags.join(', ')}`)
      for (const pkg of published) {
        for (const additionalTag of additionalTags) {
          try {
            console.info(`  🏷️ Adding tag ${additionalTag} to ${pkg.name}@${pkg.version}`)
            await addDistTag(pkg.name, pkg.version, additionalTag)
          } catch (error) {
            console.error(`  💥 Failed to add tag ${additionalTag} to ${pkg.name}@${pkg.version}:`, error)
          }
        }
      }
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
