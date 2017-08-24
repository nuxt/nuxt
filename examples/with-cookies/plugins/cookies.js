import cookie from 'cookie'

export let cookies

// Called only on client-side
export const refreshCookies = () => {
  cookies = cookie.parse(document.cookie)
  return cookies
}

/*
** Executed by ~/.nuxt/index.js with context given
** This method can be asynchronous
*/
export default ({ isServer, req }) => {
  // We update the cookies variable
  // So we can read it into our page with: import { cookies } from '~/plugins/cookies.js'
  cookies = cookie.parse(isServer ? req.headers.cookie : document.cookie)
}
