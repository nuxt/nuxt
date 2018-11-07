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
  if (socket.isModernBrowser === undefined) {
    const ua = headers && headers['user-agent']
    socket.isModernBrowser = isModernBrowser(ua)
  }
  req.isModernBrowser = socket.isModernBrowser
  next()
}
