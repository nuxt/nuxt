export const URL = globalThis.URL
export const URLSearchParams = globalThis.URLSearchParams

function notSupported () {
  throw new Error('[nuxt/vite] whatwg-url low level API is not supported yet!')
}

export const parseURL = notSupported
export const basicURLParse = notSupported
export const serializeURL = notSupported
export const serializeHost = notSupported
export const serializeInteger = notSupported
export const serializeURLOrigin = notSupported
export const setTheUsername = notSupported
export const setThePassword = notSupported
export const cannotHaveAUsernamePasswordPort = notSupported
export const percentDecodeBytes = notSupported
export const percentDecodeString = notSupported
