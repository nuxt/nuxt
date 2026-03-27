import { createError } from '../composables/error'
import { runtimeWarn } from '../utils'
import { E1004 } from '../error-codes'

const intervalError = '`setInterval` should not be used on the server. Consider wrapping it with an `onNuxtReady`, `onBeforeMount` or `onMounted` lifecycle hook, or ensure you only call it in the browser by checking `import.meta.client`.'

export const setInterval: typeof globalThis.setInterval = import.meta.client
  ? globalThis.setInterval
  : (() => {
      if (import.meta.dev) {
        throw createError({
          status: 500,
          message: intervalError,
        })
      }

      runtimeWarn('`setInterval` should not be used on the server.', { code: E1004, fix: 'Consider wrapping it with an `onNuxtReady`, `onBeforeMount` or `onMounted` lifecycle hook, or ensure you only call it in the browser by checking `import.meta.client`.' })
    }) as any
