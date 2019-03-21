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
  return Boolean(modernBrowsers[browser.name] && semver.gte(browserVersion, modernBrowsers[browser.name]))
}

const distinctModernModeOptions = [false, 'client', 'server']

const detectModernBuild = ({ options, resources }) => {
  if (distinctModernModeOptions.includes(options.modern)) {
    return
  }

  if (!resources.modernManifest) {
    options.modern = false
    return
  }

  options.modern = options.render.ssr ? 'server' : 'client'
  consola.info(`Modern bundles are detected. Modern mode (${chalk.green.bold(options.modern)}) is enabled now.`)
}

const detectModernBrowser = ({ socket = {}, headers }) => {
  if (socket.isModernBrowser === undefined) {
    const ua = headers && headers['user-agent']
    socket.isModernBrowser = isModernBrowser(ua)
  }

  return socket.isModernBrowser
}

export default ({ context }) => {
  let detected = false
  return (req, res, next) => {
    if (!detected) {
      detectModernBuild(context)
      detected = true
    }
    if (context.options.modern !== false) {
      req.modernMode = detectModernBrowser(req)
    }
    next()
  }
}
