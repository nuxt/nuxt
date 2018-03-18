import { resolve } from 'path'

import rp from 'request-promise-native'

import { Nuxt, Builder } from '..'

const port = 4005
const url = route => 'http://localhost:' + port + route

const startCSPTestServer = async (csp) => {
  const options = {
    rootDir: resolve(__dirname, 'fixtures/basic'),
    buildDir: '.nuxt-ssr-csp',
    dev: false,
    build: { stats: false },
    render: { csp }
  }

  let nuxt = null
  nuxt = new Nuxt(options)
  const builder = new Builder(nuxt)
  await builder.build()
  await nuxt.listen(port, '0.0.0.0')

  return nuxt
}

describe('basic ssr csp', () => {
  test(
    'Not contain Content-Security-Policy header, when csp.enabled is not set',
    async () => {
      const nuxt = await startCSPTestServer({})
      const { headers } = await rp(url('/stateless'), {
        resolveWithFullResponse: true
      })

      expect(headers['content-security-policy']).toBe(undefined)

      await nuxt.close()
    }
  )

  test(
    'Contain Content-Security-Policy header, when csp.enabled is only set',
    async () => {
      const cspOption = {
        enabled: true
      }

      const nuxt = await startCSPTestServer(cspOption)
      const { headers } = await rp(url('/stateless'), {
        resolveWithFullResponse: true
      })

      expect(headers['content-security-policy']).toMatch(/^script-src 'self' 'sha256-.*'$/)

      await nuxt.close()
    }
  )

  test(
    'Contain Content-Security-Policy header, when csp.allowedSources set',
    async () => {
      const cspOption = {
        enabled: true,
        allowedSources: ['https://example.com', 'https://example.io']
      }

      const nuxt = await startCSPTestServer(cspOption)
      const { headers } = await rp(url('/stateless'), {
        resolveWithFullResponse: true
      })

      expect(headers['content-security-policy']).toMatch(/^script-src 'self' 'sha256-.*'/)
      expect(headers['content-security-policy'].includes('https://example.com')).toBe(true)
      expect(headers['content-security-policy'].includes('https://example.io')).toBe(true)

      await nuxt.close()
    }
  )

  test(
    'Contain Content-Security-Policy header, when csp.policies set',
    async () => {
      const cspOption = {
        enabled: true,
        policies: {
          'default-src': [`'none'`],
          'script-src': ['https://example.com', 'https://example.io']
        }
      }

      const nuxt = await startCSPTestServer(cspOption)
      const { headers } = await rp(url('/stateless'), {
        resolveWithFullResponse: true
      })

      expect(headers['content-security-policy']).toMatch(/default-src 'none'/)
      expect(headers['content-security-policy']).toMatch(/script-src 'self' 'sha256-.*'/)
      expect(headers['content-security-policy'].includes('https://example.com')).toBe(true)
      expect(headers['content-security-policy'].includes('https://example.io')).toBe(true)

      await nuxt.close()
    }
  )

  test(
    'Contain Content-Security-Policy header, when csp.policies.script-src is not set',
    async () => {
      const cspOption = {
        enabled: true,
        policies: {
          'default-src': [`'none'`]
        }
      }

      const nuxt = await startCSPTestServer(cspOption)
      const { headers } = await rp(url('/stateless'), {
        resolveWithFullResponse: true
      })

      expect(headers['content-security-policy']).toMatch(/default-src 'none'/)
      expect(headers['content-security-policy']).toMatch(/script-src 'self' 'sha256-.*'/)

      await nuxt.close()
    }
  )
})
