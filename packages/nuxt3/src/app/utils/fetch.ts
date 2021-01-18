// TODO: Move to a nuxt-contrib utility
import destr from 'destr'

// TODO: polyfill by env (nuxt) not by util
const _fetch = process.server ? require('node-fetch') : global.fetch

export async function httpFetch (path: string) {
  const res = await _fetch(path)
  if (!res.ok) {
    throw new Error(res)
  }
  const data = await res.text()

  return destr(data)
}
