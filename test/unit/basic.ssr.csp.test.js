import { getPort, loadFixture, Nuxt, rp } from '../utils'

let port
const url = route => 'http://localhost:' + port + route

const startCSPTestServer = async (csp) => {
  const options = loadFixture('basic', { render: { csp } })
  const nuxt = new Nuxt(options)
  port = await getPort()
  await nuxt.listen(port, '0.0.0.0')
  return nuxt
}

describe('basic ssr csp', () => {
  test(
    'Not contain Content-Security-Policy header, when csp is false',
    async () => {
      const nuxt = await startCSPTestServer(false)
      const { headers } = await rp(url('/stateless'), {
        resolveWithFullResponse: true
      })

      expect(headers['content-security-policy']).toBe(undefined)

      await nuxt.close()
    }
  )

  test(
    'Contain Content-Security-Policy header, when csp is set',
    async () => {
      const nuxt = await startCSPTestServer(true)
      const { headers } = await rp(url('/stateless'), {
        resolveWithFullResponse: true
      })

      expect(headers['content-security-policy']).toMatch(/^script-src 'self' 'sha256-.*'$/)

      await nuxt.close()
    }
  )

  test(
    'Contain only unique hashes in header when csp is set',
    async () => {
      const nuxt = await startCSPTestServer(true)
      const { headers } = await rp(url('/stateless'), {
        resolveWithFullResponse: true
      })

      const hashes = headers['content-security-policy'].split(' ').filter(s => s.startsWith('\'sha256-'))
      const uniqueHashes = [...new Set(hashes)]

      expect(uniqueHashes.length).toBe(hashes.length)

      await nuxt.close()
    }
  )

  test(
    'Contain Content-Security-Policy header, when csp.allowedSources set',
    async () => {
      const cspOption = {
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
      expect(headers['content-security-policy']).toMatch(/script-src 'sha256-(.*)?' 'self'/)
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
      expect(headers['content-security-policy']).toMatch(/script-src 'sha256-.*' 'self'$/)

      await nuxt.close()
    }
  )

  test(
    'Contain only unique hashes in header when csp.policies is set',
    async () => {
      const policies = {
        'default-src': [`'self'`],
        'script-src': [`'self'`],
        'style-src': [`'self'`]
      }

      const nuxt = await startCSPTestServer({
        policies
      })

      for (let i = 0; i < 5; i++) {
        await rp(url('/stateless'), {
          resolveWithFullResponse: true
        })
      }

      const { headers } = await rp(url('/stateful'), {
        resolveWithFullResponse: true
      })

      const hashes = headers['content-security-policy'].split(' ').filter(s => s.startsWith('\'sha256-'))
      const uniqueHashes = [...new Set(hashes)]

      expect(uniqueHashes.length).toBe(hashes.length)

      await nuxt.close()
    }
  )
})
