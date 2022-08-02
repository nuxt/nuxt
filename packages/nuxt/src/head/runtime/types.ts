export type Props = Readonly<Record<string, any>>

export type FetchPriority = 'high' | 'low' | 'auto'

export type CrossOrigin = '' | 'anonymous' | 'use-credentials'

export type HTTPEquiv =
  | 'content-security-policy'
  | 'content-type'
  | 'default-style'
  | 'refresh'
  | 'x-ua-compatible'

export type ReferrerPolicy =
  | ''
  | 'no-referrer'
  | 'no-referrer-when-downgrade'
  | 'same-origin'
  | 'origin'
  | 'strict-origin'
  | 'origin-when-cross-origin'
  | 'strict-origin-when-cross-origin'
  | 'unsafe-url'

export type LinkRelationship =
  | 'alternate'
  | 'author'
  | 'canonical'
  | 'dns-prefetch'
  | 'help'
  | 'icon'
  | 'license'
  | 'manifest'
  | 'me'
  | 'modulepreload'
  | 'next'
  | 'pingback'
  | 'preconnect'
  | 'prefetch'
  | 'preload'
  | 'prerender'
  | 'prev'
  | 'search'
  | 'stylesheet'
  | (string & {})

export type Target = '_blank' | '_self' | '_parent' | '_top' | (string & {})
