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

const detectModernBrowser = ({ socket = {}, headers }) => {
  if (socket.isModernBrowser === undefined) {
    const ua = headers && headers['user-agent']
    socket.isModernBrowser = isModernBrowser(ua)
  }

  return socket.isModernBrowser
}

export default ({ serverContext }) => {
  return (req, res, next) => {
    if (serverContext.options.modern !== false) {
      req._modern = detectModernBrowser(req)
    }
    next()
  }
}
