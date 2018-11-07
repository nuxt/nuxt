import { ModernBrowsers } from '@nuxt/common'
import { matchesUA } from 'browserslist-useragent'

const modernBrowsers = Object.keys(ModernBrowsers)
  .map(browser => `${browser} >= ${ModernBrowsers[browser]}`)

const isModernBrowser = (ua) => {
  return Boolean(ua) && matchesUA(ua, {
    allowHigherVersions: true,
    browsers: modernBrowsers
  })
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
