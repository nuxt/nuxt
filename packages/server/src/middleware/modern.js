import chalk from 'chalk'
import consola from 'consola'
import UAParser from 'ua-parser-js'
import semver from 'semver'

import ModernBrowsers from './modern-browsers'

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
  if (!browserVersion) {
    return false
  }
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

const detectModernBrowser = ({ socket = {}, headers }) => {
  if (socket.isModernBrowser === undefined) {
    const ua = headers && headers['user-agent']
    socket.isModernBrowser = isModernBrowser(ua)
  }
}

const setModernMode = (req, options) => {
  const { socket = {} } = req
  const { isModernBrowser } = socket
  if (options.modern === 'server') {
    req.modernMode = isModernBrowser
  }
  if (options.dev && !!options.modern) {
    req.devModernMode = isModernBrowser
  }
}

export default ({ context }) => (req, res, next) => {
  detectModernBuild(context)
  detectModernBrowser(req)
  setModernMode(req, context.options)
  next()
}
