import UAParser from 'ua-parser-js'

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

let semver
let __modernBrowsers

const getModernBrowsers = () => {
  if (__modernBrowsers) {
    return __modernBrowsers
  }

  __modernBrowsers = Object.keys(ModernBrowsers)
    .reduce((allBrowsers, browser) => {
      allBrowsers[browser] = semver.coerce(ModernBrowsers[browser])
      return allBrowsers
    }, {})
  return __modernBrowsers
}

export const isModernBrowser = (ua) => {
  if (!ua) {
    return false
  }
  if (!semver) {
    semver = require('semver')
  }
  const { browser } = UAParser(ua)
  const browserVersion = semver.coerce(browser.version)
  if (!browserVersion) {
    return false
  }
  const modernBrowsers = getModernBrowsers()
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

// https://gist.github.com/samthor/64b114e4a4f539915a95b91ffd340acc
export const safariNoModuleFix = '!function(){var e=document,t=e.createElement("script");if(!("noModule"in t)&&"onbeforeload"in t){var n=!1;e.addEventListener("beforeload",function(e){if(e.target===t)n=!0;else if(!e.target.hasAttribute("nomodule")||!n)return;e.preventDefault()},!0),t.type="module",t.src=".",e.head.appendChild(t),t.remove()}}();'
