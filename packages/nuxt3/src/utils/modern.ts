import { UAParser } from 'ua-parser-js'

import type { SemVer } from 'semver'
import type { IncomingMessage } from 'connect'

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
} as const

type ModernBrowsers = { -readonly [key in keyof typeof ModernBrowsers]: SemVer }

let semver: typeof import('semver')
let __modernBrowsers: ModernBrowsers

const getModernBrowsers = () => {
  if (__modernBrowsers) {
    return __modernBrowsers
  }

  __modernBrowsers = (Object.keys(ModernBrowsers) as Array<
    keyof typeof ModernBrowsers
  >).reduce(
    (allBrowsers, browser) => {
      const version = semver.coerce(ModernBrowsers[browser])
      if (version) { allBrowsers[browser] = version }
      return allBrowsers
    },
    {} as ModernBrowsers
  )
  return __modernBrowsers
}

interface NuxtRequest extends IncomingMessage {
  socket: IncomingMessage['socket'] & {
    _modern?: boolean
  }
}

export const isModernBrowser = (ua: string) => {
  if (!ua) {
    return false
  }
  if (!semver) {
    semver = require('semver')
  }
  const browser = new UAParser(ua).getBrowser()
  const browserVersion = semver.coerce(browser.version)
  if (!browserVersion) {
    return false
  }
  const modernBrowsers = getModernBrowsers()
  const name = browser.name as keyof typeof modernBrowsers
  return Boolean(
    name && name in modernBrowsers && semver.gte(browserVersion, modernBrowsers[name])
  )
}

export const isModernRequest = (req: NuxtRequest, modernMode: boolean | string = false) => {
  if (modernMode === false) {
    return false
  }

  const { socket = {} as NuxtRequest['socket'], headers } = req
  if (socket._modern === undefined) {
    const ua = headers && headers['user-agent']
    socket._modern = ua && isModernBrowser(ua)
  }

  return socket._modern
}

// https://gist.github.com/samthor/64b114e4a4f539915a95b91ffd340acc
export const safariNoModuleFix = '!function(){var e=document,t=e.createElement("script");if(!("noModule"in t)&&"onbeforeload"in t){var n=!1;e.addEventListener("beforeload",function(e){if(e.target===t)n=!0;else if(!e.target.hasAttribute("nomodule")||!n)return;e.preventDefault()},!0),t.type="module",t.src=".",e.head.appendChild(t),t.remove()}}();'
