import { readFile } from 'node:fs/promises'
import { findPath } from '@nuxt/kit'
import { configDiagnostics } from '@nuxt/kit/internal'
import { basename } from 'pathe'
import { link } from 'clickable-path'

/**
 * Check for those external configuration files that are not compatible with Nuxt,
 * and warns the user about them.
 * @see {@link https://nuxt.com/docs/4.x/getting-started/configuration#external-configuration-files}
 */
export async function checkForExternalConfigurationFiles () {
  const checkResults = await Promise.all([checkViteConfig(), checkWebpackConfig(), checkNitroConfig(), checkPostCSSConfig()])
  const foundFiles = checkResults.filter(Boolean) as string[]

  if (!foundFiles.length) {
    return
  }

  configDiagnostics.NUXT_B5004({ files: foundFiles.map(file => `\`${file}\``).join(', ') })
}

// https://github.com/vitejs/vite/blob/8fe69524d25d45290179175ba9b9956cbce87a91/packages/vite/src/node/constants.ts#L38
const VITE_CONFIG_EXTENSIONS = ['.js', '.mjs', '.ts', '.cjs', '.mts', '.cts']
const VITE_PLUS_IMPORT_RE = /\bfrom\s*["']vite-plus["']|\b(?:import|require)\s*\(\s*["']vite-plus["']\s*\)/

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
  return VITE_PLUS_IMPORT_RE.test(contents)
}

async function checkViteConfig () {
  const configFile = await findViteConfig()
  if (!configFile || await isVitePlusConfig(configFile)) {
    return
  }
  return formatConfigFile(configFile)
}

function checkWebpackConfig () {
  // https://webpack.js.org/configuration/configuration-languages/
  return checkConfigFileExistence('webpack.config', ['.js', '.mjs', '.ts', '.cjs', '.mts', '.cts', '.coffee'])
}

function checkNitroConfig () {
  // https://nitro.build/config
  return checkConfigFileExistence('nitro.config', ['.ts', '.mts'])
}

function checkPostCSSConfig () {
  return checkConfigFileExistence('postcss.config', ['.js', '.cjs'])
}

async function checkConfigFileExistence (fileName: string, extensions: string[]) {
  const configFile = await findPath(fileName, { extensions }).catch(() => null)
  return configFile ? formatConfigFile(configFile) : undefined
}

function formatConfigFile (configFile: string) {
  return link(configFile, { formatter: absolute => basename(absolute) })
}
