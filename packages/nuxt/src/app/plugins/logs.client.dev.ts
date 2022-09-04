import { defineNuxtPlugin } from '#app'

export default defineNuxtPlugin((nuxtApp) => {
  // Only activate in development
  const logs = nuxtApp.payload.logs || []
  if (logs.length > 0) {
    const ssrLogStyle = 'background: #003C3C;border-radius: 0.5em;color: white;font-weight: bold;padding: 2px 0.5em;'
    console.groupCollapsed && console.groupCollapsed('%cNuxt Server Logs', ssrLogStyle)
    logs.forEach((logObj: any) => (console[logObj.type as 'log'] || console.log)(...logObj.args))
    delete nuxtApp.payload.logs
    console.groupEnd && console.groupEnd()
  }
})
