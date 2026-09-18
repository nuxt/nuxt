/**
 * Options for writing a cookie, covering the `Set-Cookie` attributes of RFC 6265 and its
 * extensions.
 *
 * @since 5.0.0
 */
export interface CookieSerializeOptions {
  maxAge?: number
  expires?: Date
  domain?: string
  path?: string
  httpOnly?: boolean
  secure?: boolean
  partitioned?: boolean
  priority?: 'low' | 'medium' | 'high'
  sameSite?: boolean | 'lax' | 'strict' | 'none'
  /** Defaults to `encodeURIComponent`. */
  encode?: (value: string) => string
  /** Defaults to `JSON.stringify`. */
  stringify?: (value: unknown) => string
}
