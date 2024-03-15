import { createError } from '../composables/error'

const intervalError = '[nuxt] `setInterval` should not be used on the server. Consider wrapping it with an `onNuxtReady`, `onBeforeMount` or `onMounted` lifecycle hook, or ensure you only call it in the browser by checking `import.meta.client`.'

export const setInterval = import.meta.client
  ? window.setInterval
  : () => {
      if (import.meta.dev) {
        throw createError({
          statusCode: 500,
          message: intervalError
        })
      }

      console.error(intervalError)
    }
