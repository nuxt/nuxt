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

export default function (req, res, next) {
  const { socket = {}, headers } = req
  if (socket.modernMode === undefined) {
    const ua = headers && headers['user-agent']
    socket.modernMode = isModernBrowser(ua)
  }
  req.modernMode = socket.modernMode
  next()
}
