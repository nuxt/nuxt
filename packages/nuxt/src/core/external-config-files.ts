import { findPath } from '@nuxt/kit'
import { basename } from 'pathe'
import { logger } from '../utils'

interface CheckAndWarnAboutConfigFileExistenceOptions {
  fileName: string
  extensions: string[]
  createWarningMessage: (foundFile: string) => string
}

/**
 * Check for those external configuration files that are not compatible with Nuxt,
 * and warns the user about them.
 * @see {@link https://nuxt.com/docs/getting-started/configuration#external-configuration-files}
 */
export async function checkForExternalConfigurationFiles () {
  function checkViteConfig () {
  // https://github.com/vitejs/vite/blob/8fe69524d25d45290179175ba9b9956cbce87a91/packages/vite/src/node/constants.ts#L38
    return checkAndWarnAboutConfigFileExistence({
      fileName: 'vite.config',
      extensions: ['.js', '.mjs', '.ts', '.cjs', '.mts', '.cts'],
      createWarningMessage: foundFile => `Using \`${foundFile}\` is not supported together with Nuxt. Use \`options.vite\` instead. You can read more in \`https://nuxt.com/docs/api/nuxt-config#vite\`.`,
    })
  }

  function checkWebpackConfig () {
  // https://webpack.js.org/configuration/configuration-languages/
    return checkAndWarnAboutConfigFileExistence({
      fileName: 'webpack.config',
      extensions: ['.js', '.mjs', '.ts', '.cjs', '.mts', '.cts', 'coffee'],
      createWarningMessage: foundFile => `Using \`${foundFile}\` is not supported together with Nuxt. Use \`options.webpack\` instead. You can read more in \`https://nuxt.com/docs/api/nuxt-config#webpack-1\`.`,
    })
  }

  function checkNitroConfig () {
  // https://nitro.build/config#configuration
    return checkAndWarnAboutConfigFileExistence({
      fileName: 'nitro.config',
      extensions: ['.ts', '.mts'],
      createWarningMessage: foundFile => `Using \`${foundFile}\` is not supported together with Nuxt. Use \`options.nitro\` instead. You can read more in \`https://nuxt.com/docs/api/nuxt-config#nitro\`.`,
    })
  }

  function checkPostCSSConfig () {
    return checkAndWarnAboutConfigFileExistence({
      fileName: 'postcss.config',
      extensions: ['.js', '.cjs'],
      createWarningMessage: foundFile => `Using \`${foundFile}\` is not supported together with Nuxt. Use \`options.postcss\` instead. You can read more in \`https://nuxt.com/docs/api/nuxt-config#postcss\`.`,
    })
  }

  async function checkAndWarnAboutConfigFileExistence (options: CheckAndWarnAboutConfigFileExistenceOptions) {
    const { fileName, extensions, createWarningMessage } = options

    const configFile = await findPath(fileName, { extensions }).catch(() => null)
    if (configFile) {
      return createWarningMessage(basename(configFile))
    }
  }

  const checkResults = await Promise.all([checkViteConfig(), checkWebpackConfig(), checkNitroConfig(), checkPostCSSConfig()])
  const warningMessages = checkResults.filter(Boolean) as string[]

  if (!warningMessages.length) {
    return
  }

  const foundOneExternalConfig = warningMessages.length === 1
  if (foundOneExternalConfig) {
    logger.warn(warningMessages[0])
  } else {
    const warningsAsList = warningMessages.map(message => `- ${message}`).join('\n')
    const warning = `Found multiple external configuration files: \n\n${warningsAsList}`
    logger.warn(warning)
  }
}
