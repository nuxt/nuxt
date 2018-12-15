import chalk from 'chalk'
import consola from 'consola'
import { ModernBrowsers } from '@nuxt/common'
import UAParser from 'ua-parser-js'
import semver from 'semver'

const modernBrowsers = Object.keys(ModernBrowsers)
  .reduce((allBrowsers, browser) => {
    allBrowsers[browser] = semver.coerce(ModernBrowsers[browser])
    return allBrowsers
  }, {})

const isModernBrowser = (ua) => {
  if (!ua) {
    return false
  }
  const { browser } = UAParser(ua)
  const browserVersion = semver.coerce(browser.version)
  return modernBrowsers[browser.name] && semver.gte(browserVersion, modernBrowsers[browser.name])
}

let detected = false

const detectModernBuild = ({ options, resources }) => {
  if (detected === false && ![false, 'client', 'server'].includes(options.modern)) {
    detected = true
    if (resources.modernManifest) {
      options.modern = options.render.ssr ? 'server' : 'client'
      consola.info(`Modern bundles are detected. Modern mode (${chalk.green.bold(options.modern)}) is enabled now.`)
    } else {
      options.modern = false
    }
  }
}

const detectModernBrowser = (req, options) => {
  if (options.modern === 'server') {
    const { socket = {}, headers } = req
    if (socket.modernMode === undefined) {
      const ua = headers && headers['user-agent']
      socket.modernMode = isModernBrowser(ua)
    }
    req.modernMode = socket.modernMode
  }
}

export default ({ context }) => (req, res, next) => {
  detectModernBuild(context)
  detectModernBrowser(req, context.options)
  next()
}
