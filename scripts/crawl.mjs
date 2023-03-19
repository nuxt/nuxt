import Crawler from 'crawler'
import consola from 'consola'
import { parseURL, withoutTrailingSlash } from 'ufo'
import chalk from 'chalk'
import * as actions from '@actions/core'
import { isCI } from 'std-env'

const logger = consola.withTag('crawler')

const baseURL = withoutTrailingSlash(process.env.BASE_URL || 'https://nuxt.com')
const startingURL = baseURL + '/'

const excludedExtensions = ['svg', 'png', 'jpg', 'sketch', 'ico', 'gif', 'zip']
const urlsToOmit = ['http://localhost:3000']

// TODO: remove when migrating to Nuxt 3/Docus
const errorsToIgnore = [
  '/guide/directory-structure/nuxt.config',
  '/guide/directory-structure',
  '/guide/directory-structure/app.config',
  '/api/configuration/nuxt-config',
  '/guide/deploy',
  '/guide/features/app-config'
]

// GLOBALS
const urls = new Set([startingURL])
const erroredUrls = new Set()

const referrers = new Map()

/**
 * @param {string} path Path to check
 * @param {string | undefined} referrer The referring page
 */
function queue (path, referrer) {
  if (!path) {
    const message = chalk.red(`${chalk.bold('✗')} ${referrer} linked to empty href`)
    if (isCI && path?.match(/\/docs\//)) { actions.error(message) }
    logger.log(message)
    return
  }

  if (urlsToOmit.some(url => path.startsWith(url))) { return }

  const { pathname, origin } = new URL(path, referrer)

  // Don't crawl the same page more than once
  const url = `${origin}${pathname}`
  if (!url || urls.has(url) || !crawler) { return }

  // Don't try to visit linked assets (e.g. SVGs)
  const extension = url.split('.').pop()
  if (extension && excludedExtensions.includes(extension)) { return }

  // Don't crawl external URLs
  if (origin !== baseURL) { return }

  referrers.set(url, referrer)
  urls.add(url)

  crawler.queue(url)
}

const crawler = new Crawler({
  maxConnections: 100,
  callback (error, res, done) {
    const { $ } = res
    const { uri } = res.options
    // @ts-ignore
    const { statusCode } = res.request.response

    if (error || ![200, 301, 302].includes(statusCode) || !$) {
      // TODO: normalize relative links in module readmes - https://github.com/nuxt/nuxt.com/issues/1271
      if (errorsToIgnore.includes(parseURL(uri).pathname) || referrers.get(uri)?.match(/\/modules\//) || !uri?.match(/\/docs\//)) {
        const message = chalk.gray(`${chalk.bold('✗')} ${uri} (${statusCode}) [<- ${referrers.get(uri)}] (ignored)`)
        logger.log(message)
        return done()
      }
      const message = chalk.red(`${chalk.bold('✗')} ${uri} (${statusCode}) [<- ${referrers.get(uri)}]`)
      if (isCI) { actions.error(message) }
      logger.log(message)
      erroredUrls.add(uri)
      return done()
    }

    if (!$) {
      const message = `Could not parse HTML for ${uri}`
      logger.error(message)
      if (isCI) { actions.warning(message) }
      return done()
    }

    $('a:not([href*=mailto]):not([href*=tel])').each((_, el) => {
      if ('attribs' in el && 'href' in el.attribs) {
        queue(el.attribs.href, uri)
      }
    })

    logger.success(chalk.green(uri))
    logger.debug(uri, `[${crawler.queueSize} / ${urls.size}]`)

    if (!isCI && crawler.queueSize === 1) {
      logger.log('')
      logger.info(`Checked \`${urls.size}\` pages.`)
      // Tasks to run at the end.
      if (erroredUrls.size) {
        const message = `${chalk.bold(erroredUrls.size)} errors found on ${chalk.bold(baseURL)}.`
        const error = new Error(`\n\n${message}\n`)
        error.message = message
        error.stack = ''
        throw error
      }
    }

    done()
  }
})

logger.log('')
logger.info(`Checking \`${baseURL}\`.`)
logger.info(`Ignoring file extensions: \`${excludedExtensions.join(', ')}.\`\n`)

crawler.queue(startingURL)
