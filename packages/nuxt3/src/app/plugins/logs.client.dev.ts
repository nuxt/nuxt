/* eslint-disable no-console */
import type { Plugin } from 'nuxt/app'

export default <Plugin> function logs ({ app }) {
  // Only activate in development
  const logs = app.$nuxt.payload.logs || []
  if (logs.length > 0) {
    const ssrLogStyle = 'background: #003C3C;border-radius: 0.5em;color: white;font-weight: bold;padding: 2px 0.5em;'
    console.groupCollapsed && console.groupCollapsed('%cNuxt Server Logs', ssrLogStyle)
    logs.forEach(logObj => (console[logObj.type] || console.log)(...logObj.args))
    delete app.$nuxt.payload.logs
    console.groupEnd && console.groupEnd()
  }
}
