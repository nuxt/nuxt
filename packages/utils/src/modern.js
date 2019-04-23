import UAParser from 'ua-parser-js'
import semver from 'semver'

export const ModernBrowsers = {
  Edge: '16',
  Firefox: '60',
  Chrome: '61',
  'Chrome Headless': '61',
  Chromium: '61',
  Iron: '61',
  Safari: '10.1',
  Opera: '48',
  Yandex: '18',
  Vivaldi: '1.14',
  'Mobile Safari': '10.3'
}

const modernBrowsers = Object.keys(ModernBrowsers)
  .reduce((allBrowsers, browser) => {
    allBrowsers[browser] = semver.coerce(ModernBrowsers[browser])
    return allBrowsers
  }, {})

export const isModernBrowser = (ua) => {
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

export const isModernRequest = (req, modernMode = false) => {
  if (modernMode === false) {
    return false
  }

  const { socket = {}, headers } = req
  if (socket._modern === undefined) {
    const ua = headers && headers['user-agent']
    socket._modern = isModernBrowser(ua)
  }

  return socket._modern
}
