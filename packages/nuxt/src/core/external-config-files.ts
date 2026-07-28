import { configDiagnostics, findPath } from '@nuxt/kit'
import { basename } from 'pathe'

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

function checkViteConfig () {
  // https://github.com/vitejs/vite/blob/8fe69524d25d45290179175ba9b9956cbce87a91/packages/vite/src/node/constants.ts#L38
  return checkConfigFileExistence('vite.config', ['.js', '.mjs', '.ts', '.cjs', '.mts', '.cts'])
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
  return configFile ? basename(configFile) : undefined
}
