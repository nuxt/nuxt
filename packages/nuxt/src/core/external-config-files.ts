import { readFile } from 'node:fs/promises'
import { findPath } from '@nuxt/kit'
import { configDiagnostics } from '@nuxt/kit/internal'
import { basename } from 'pathe'
import { link } from 'clickable-path'
import { parseAndWalk } from 'oxc-walker'

/**
 * Check for those external configuration files that are not compatible with Nuxt,
 * and warns the user about them.
 * @see {@link https://nuxt.com/docs/5.x/getting-started/configuration#external-configuration-files}
 */
export async function checkForExternalConfigurationFiles () {
  const checkResults = await Promise.all([
    checkViteConfig(),
    ...Object.entries(incompatibleConfigFiles).map(([fileName, extensions]) => checkConfigFileExistence(fileName, extensions)),
  ])
  const foundFiles = checkResults.filter(Boolean) as string[]

  if (!foundFiles.length) {
    return
  }

  configDiagnostics.NUXT_B5004({ files: foundFiles.map(file => `\`${file}\``).join(', ') })
}

// https://github.com/vitejs/vite/blob/8fe69524d25d45290179175ba9b9956cbce87a91/packages/vite/src/node/constants.ts#L38
const VITE_CONFIG_EXTENSIONS = ['.js', '.mjs', '.ts', '.cjs', '.mts', '.cts']

/**
 * Find a `vite.config` file in `cwd` that configures Vite+ (it imports from `vite-plus`).
 */
export async function findVitePlusConfig (cwd?: string) {
  const configFile = await findViteConfig(cwd)
  if (configFile && await isVitePlusConfig(configFile)) {
    return configFile
  }
}

function findViteConfig (cwd?: string) {
  return findPath('vite.config', { cwd, extensions: VITE_CONFIG_EXTENSIONS }).catch(() => null)
}

async function isVitePlusConfig (path: string) {
  const contents = await readFile(path, 'utf8').catch(() => '')
  if (!contents.includes('vite-plus')) {
    return false
  }
  let importsVitePlus = false
  parseAndWalk(contents, path, (node) => {
    const specifier = node.type === 'ImportDeclaration' || node.type === 'ImportExpression'
      ? node.source
      : node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require'
        ? node.arguments[0]
        : undefined
    if (specifier?.type === 'Literal' && specifier.value === 'vite-plus') {
      importsVitePlus = true
    }
  })
  return importsVitePlus
}

async function checkViteConfig () {
  const configFile = await findViteConfig()
  if (!configFile || await isVitePlusConfig(configFile)) {
    return
  }
  return formatConfigFile(configFile)
}

const incompatibleConfigFiles: Record<string, string[]> = {
  // https://webpack.js.org/configuration/configuration-languages/
  'webpack.config': ['.js', '.mjs', '.ts', '.cjs', '.mts', '.cts', '.coffee'],
  // https://nitro.build/config
  'nitro.config': ['.ts', '.mts'],
  'postcss.config': ['.js', '.cjs'],
}

async function checkConfigFileExistence (fileName: string, extensions: string[]) {
  const configFile = await findPath(fileName, { extensions }).catch(() => null)
  return configFile ? formatConfigFile(configFile) : undefined
}

function formatConfigFile (configFile: string) {
  return link(configFile, { formatter: absolute => basename(absolute) })
}
