import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { isAbsolute, join } from 'pathe'
import { createDefu } from 'defu'
import type { Nitro } from 'nitropack/types'
import type { ContentSecurityPolicyValue } from './types'

export function headerStringFromObject (optionValue: ContentSecurityPolicyValue | false) {
  // False value translates into empty header
  if (optionValue === false) {
    return ''
  }
  // Stringify the options passed as a JS object
  return Object.entries(optionValue)
    .filter(([, value]) => value !== false)
    .map(([directive, sources]) => {
      if (directive === 'upgrade-insecure-requests') {
        return 'upgrade-insecure-requests;'
      } else {
        const stringifiedSources = (typeof sources === 'string')
          ? sources
          : (sources as string[])
              .map(source => source.trim())
              .join(' ')
        return `${directive} ${stringifiedSources};`
      }
    })
    .join(' ')
}

export const defuReplaceArray = createDefu((obj, key, value) => {
  if (Array.isArray(obj[key]) || Array.isArray(value)) {
    obj[key] = value
    return true
  }
})

export function generateRandomNonce () {
  const array = new Uint8Array(18)
  crypto.getRandomValues(array)
  const nonce = btoa(String.fromCharCode(...array))
  return nonce
}

export async function generateHash (content: Buffer | string, hashAlgorithm: 'SHA-256' | 'SHA-384' | 'SHA-512') {
  let buffer: Uint8Array
  if (typeof content === 'string') {
    buffer = new TextEncoder().encode(content)
  } else {
    buffer = new Uint8Array(content)
  }
  const hashBuffer = await crypto.subtle.digest(hashAlgorithm, buffer)
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hashBuffer)))
  const prefix = hashAlgorithm.replace('-', '').toLowerCase()
  return `${prefix}-${base64}`
}

export async function hashBundledAssets (nitro: Nitro) {
  const hashAlgorithm = 'SHA-384'
  const sriHashes: Record<string, string> = {}

  // Will be later necessary to construct url
  const { cdnURL: appCdnUrl = '', baseURL: appBaseUrl } = nitro.options.runtimeConfig.app

  // Go through all public assets folder by folder
  const publicAssets = nitro.options.publicAssets
  for (const publicAsset of publicAssets) {
    const { dir, baseURL = '' } = publicAsset

    if (existsSync(dir)) {
      // Node 16 compatibility maintained
      // Node 18.17+ supports recursive option on readdir
      // const entries = await readdir(dir, { withFileTypes: true, recursive: true })
      const entries = await readdir(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isFile()) {
          // Node 16 compatibility maintained
          // Node 18.17+ supports entry.path on DirEnt
          // const fullPath = join(entry.path, entry.name)
          const path = join(dir, entry.name)
          const content = await readFile(path)
          const hash = await generateHash(content, hashAlgorithm)
          // construct the url as it will appear in the head template
          const fullPath = join(baseURL, entry.name)
          let url: string
          if (appCdnUrl) {
            // If the cdnURL option was set, the url will be in the form https://...
            const relativePath = isAbsolute(fullPath) ? fullPath.slice(1) : fullPath
            const abdsoluteCdnUrl = appCdnUrl.endsWith('/') ? appCdnUrl : appCdnUrl + '/'
            url = new URL(relativePath, abdsoluteCdnUrl).href
          } else {
            // If not, the url will be in a relative form: /_nuxt/...
            url = join('/', appBaseUrl, fullPath)
          }
          sriHashes[url] = hash
        }
      }
    }
  }

  return sriHashes
}
