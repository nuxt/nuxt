import { getPort, loadFixture, Nuxt, rp } from '../utils'

let port
const url = route => 'http://localhost:' + port + route

const startCspServer = async (csp, isProduction = true) => {
  const options = await loadFixture('basic', {
    debug: !isProduction,
    render: { csp }
  })
  const nuxt = new Nuxt(options)
  await nuxt.ready()

  port = await getPort()
  await nuxt.server.listen(port, '0.0.0.0')
  return nuxt
}

const getHeader = debug => debug ? 'content-security-policy-report-only' : 'content-security-policy'
const cspHeader = getHeader(false)
const reportOnlyHeader = getHeader(true)

const startCspDevServer = csp => startCspServer(csp, false)

describe('basic ssr csp', () => {
  let nuxt

  afterEach(async () => {
    await nuxt.close()
  })

  describe('production mode', () => {
    test(
      'Not contain Content-Security-Policy header, when csp is false',
      async () => {
        nuxt = await startCspServer(false)
        const { headers } = await rp(url('/stateless'))

        expect(headers[cspHeader]).toBe(undefined)
      }
    )

    test(
      'Contain Content-Security-Policy header, when csp is set',
      async () => {
        nuxt = await startCspServer(true)
        const { headers } = await rp(url('/stateless'))

        expect(headers[cspHeader]).toMatch(/^script-src 'self' 'sha256-.*'$/)
      }
    )

    test(
      'Contain Content-Security-Policy-Report-Only header, when explicitly asked for',
      async () => {
        nuxt = await startCspDevServer({ reportOnly: true })
        const { headers } = await rp(url('/stateless'))

        expect(headers[reportOnlyHeader]).toMatch(/^script-src 'self' 'sha256-.*'$/)
      }
    )

    test(
      'Contain only unique hashes in header when csp is set',
      async () => {
        nuxt = await startCspServer(true)
        const { headers } = await rp(url('/stateless'))

        const hashes = headers[cspHeader].split(' ').filter(s => s.startsWith('\'sha256-'))
        const uniqueHashes = [...new Set(hashes)]

        expect(uniqueHashes.length).toBe(hashes.length)
      }
    )

    test(
      'Contain Content-Security-Policy header, when csp.allowedSources set',
      async () => {
        const cspOption = {
          allowedSources: ['https://example.com', 'https://example.io']
        }

        nuxt = await startCspServer(cspOption)
        const { headers } = await rp(url('/stateless'))

        expect(headers[cspHeader]).toMatch(/^script-src 'self' 'sha256-.*'/)
        expect(headers[cspHeader]).toContain('https://example.com')
        expect(headers[cspHeader]).toContain('https://example.io')
      }
    )

    test(
      'Contain Content-Security-Policy header, when csp.policies set',
      async () => {
        const cspOption = {
          enabled: true,
          policies: {
            'default-src': ['\'none\''],
            'script-src': ['https://example.com', 'https://example.io']
          }
        }

        nuxt = await startCspServer(cspOption)
        const { headers } = await rp(url('/stateless'))

        expect(headers[cspHeader]).toMatch(/default-src 'none'/)
        expect(headers[cspHeader]).toMatch(/script-src 'sha256-(.*)?' 'self'/)
        expect(headers[cspHeader]).toContain('https://example.com')
        expect(headers[cspHeader]).toContain('https://example.io')
      }
    )

    test(
      'Contain Content-Security-Policy header, when csp.policies.script-src is not set',
      async () => {
        const cspOption = {
          enabled: true,
          policies: {
            'default-src': ['\'none\'']
          }
        }

        nuxt = await startCspServer(cspOption)
        const { headers } = await rp(url('/stateless'))

        expect(headers[cspHeader]).toMatch(/default-src 'none'/)
        expect(headers[cspHeader]).toMatch(/script-src 'sha256-.*' 'self'$/)
      }
    )

    test(
      'Contain report-uri in Content-Security-Policy-Report-Only header, when explicitly asked for CSRP, allowedSources, csp.report-url',
      async () => {
        const cspOption = {
          allowedSources: ['https://example.com', 'https://example.io'],
          reportOnly: true,
          policies: {
            'report-uri': '/csp_report_uri'
          }
        }
        nuxt = await startCspDevServer(cspOption)
        const { headers } = await rp(url('/stateless'))

        expect(headers[reportOnlyHeader]).toMatch(/^script-src 'self' 'sha256-.*'/)
        expect(headers[reportOnlyHeader]).toContain('https://example.com')
        expect(headers[reportOnlyHeader]).toContain('https://example.io')
        expect(headers[reportOnlyHeader]).toContain('report-uri /csp_report_uri')
      }
    )

    test(
      'Contain only unique hashes in header when csp.policies is set',
      async () => {
        const policies = {
          'default-src': ['\'self\''],
          'script-src': ['\'self\''],
          'style-src': ['\'self\'']
        }

        nuxt = await startCspServer({
          policies
        })

        for (let i = 0; i < 5; i++) {
          await rp(url('/stateless'))
        }

        const { headers } = await rp(url('/stateful'))

        const hashes = headers[cspHeader].split(' ').filter(s => s.startsWith('\'sha256-'))
        const uniqueHashes = [...new Set(hashes)]

        expect(uniqueHashes.length).toBe(hashes.length)
      }
    )

    test(
      'Not contain hash when \'unsafe-inline\' option is present in script-src policy',
      async () => {
        const policies = {
          'script-src': ['\'unsafe-inline\'']
        }

        nuxt = await startCspServer({
          policies
        })

        for (let i = 0; i < 5; i++) {
          await rp(url('/stateless'))
        }

        const { headers } = await rp(url('/stateful'))

        expect(headers[cspHeader]).toMatch(/script-src 'self' 'unsafe-inline'$/)
      }
    )

    test(
      'Contain hash and \'unsafe-inline\' when unsafeInlineCompatibility is enabled',
      async () => {
        const policies = {
          'script-src': ['\'unsafe-inline\'']
        }

        nuxt = await startCspServer({
          unsafeInlineCompatibility: true,
          policies
        })

        for (let i = 0; i < 5; i++) {
          await rp(url('/stateless'))
        }

        const { headers } = await rp(url('/stateful'))

        expect(headers[cspHeader]).toMatch(/script-src 'sha256-.*' 'self' 'unsafe-inline'$/)
      }
    )

    // TODO: Remove this test in Nuxt 3, we will stop supporting this typo (more on: https://github.com/nuxt/nuxt.js/pull/6583)
    test(
      'Contain hash and \'unsafe-inline\' when the typo property unsafeInlineCompatiblity is enabled',
      async () => {
        const policies = {
          'script-src': ['\'unsafe-inline\'']
        }

        nuxt = await startCspServer({
          unsafeInlineCompatiblity: true,
          policies
        })

        for (let i = 0; i < 5; i++) {
          await rp(url('/stateless'))
        }

        const { headers } = await rp(url('/stateful'))

        expect(headers[cspHeader]).toMatch(/script-src 'sha256-.*' 'self' 'unsafe-inline'$/)
      }
    )
  })

  describe('debug mode', () => {
    test(
      'Not contain Content-Security-Policy-Report-Only header, when csp is false',
      async () => {
        nuxt = await startCspDevServer(false)
        const { headers } = await rp(url('/stateless'))

        expect(headers[reportOnlyHeader]).toBe(undefined)
      }
    )

    test(
      'Contain Content-Security-Policy header, when explicitly asked for',
      async () => {
        nuxt = await startCspDevServer({ reportOnly: false })
        const { headers } = await rp(url('/stateless'))

        expect(headers[cspHeader]).toMatch(/^script-src 'self' 'sha256-.*'$/)
      }
    )

    test(
      'Contain Content-Security-Policy header, when csp is set',
      async () => {
        nuxt = await startCspDevServer(true)
        const { headers } = await rp(url('/stateless'))

        expect(headers[reportOnlyHeader]).toMatch(/^script-src 'self' 'sha256-.*'$/)
      }
    )

    test(
      'Contain only unique hashes in header when csp is set',
      async () => {
        nuxt = await startCspDevServer(true)
        const { headers } = await rp(url('/stateless'))

        const hashes = headers[reportOnlyHeader].split(' ').filter(s => s.startsWith('\'sha256-'))
        const uniqueHashes = [...new Set(hashes)]

        expect(uniqueHashes.length).toBe(hashes.length)
      }
    )

    test(
      'Contain Content-Security-Policy-Report-Only header, when csp.allowedSources set',
      async () => {
        const cspOption = {
          allowedSources: ['https://example.com', 'https://example.io']
        }

        nuxt = await startCspDevServer(cspOption)
        const { headers } = await rp(url('/stateless'))

        expect(headers[reportOnlyHeader]).toMatch(/^script-src 'self' 'sha256-.*'/)
        expect(headers[reportOnlyHeader]).toContain('https://example.com')
        expect(headers[reportOnlyHeader]).toContain('https://example.io')
      }
    )

    test(
      'Contain Content-Security-Policy-Report-Only header, when csp.policies set',
      async () => {
        const cspOption = {
          enabled: true,
          policies: {
            'default-src': ['\'none\''],
            'script-src': ['https://example.com', 'https://example.io']
          }
        }

        nuxt = await startCspDevServer(cspOption)
        const { headers } = await rp(url('/stateless'))

        expect(headers[reportOnlyHeader]).toMatch(/default-src 'none'/)
        expect(headers[reportOnlyHeader]).toMatch(/script-src 'sha256-(.*)?' 'self'/)
        expect(headers[reportOnlyHeader]).toContain('https://example.com')
        expect(headers[reportOnlyHeader]).toContain('https://example.io')
      }
    )

    test(
      'Contain report-uri in Content-Security-Policy-Report-Only header, when explicitly asked for CSRP, allowedSources, csp.report-url',
      async () => {
        const cspOption = {
          allowedSources: ['https://example.com', 'https://example.io'],
          reportOnly: true,
          policies: {
            'report-uri': '/csp_report_uri'
          }
        }
        nuxt = await startCspDevServer(cspOption)
        const { headers } = await rp(url('/stateless'))

        expect(headers[reportOnlyHeader]).toMatch(/^script-src 'self' 'sha256-.*'/)
        expect(headers[reportOnlyHeader]).toContain('https://example.com')
        expect(headers[reportOnlyHeader]).toContain('https://example.io')
        expect(headers[reportOnlyHeader]).toContain('report-uri /csp_report_uri')
      }
    )

    test(
      'Contain Content-Security-Policy-Report-Only header, when csp.policies.script-src is not set',
      async () => {
        const cspOption = {
          enabled: true,
          policies: {
            'default-src': ['\'none\'']
          }
        }

        nuxt = await startCspDevServer(cspOption)
        const { headers } = await rp(url('/stateless'))

        expect(headers[reportOnlyHeader]).toMatch(/default-src 'none'/)
        expect(headers[reportOnlyHeader]).toMatch(/script-src 'sha256-.*' 'self'$/)
      }
    )

    test(
      'Contain only unique hashes in header when csp.policies is set',
      async () => {
        const policies = {
          'default-src': ['\'self\''],
          'script-src': ['\'self\''],
          'style-src': ['\'self\'']
        }

        nuxt = await startCspDevServer({
          policies
        })

        for (let i = 0; i < 5; i++) {
          await rp(url('/stateless'))
        }

        const { headers } = await rp(url('/stateful'))

        const hashes = headers[reportOnlyHeader].split(' ').filter(s => s.startsWith('\'sha256-'))
        const uniqueHashes = [...new Set(hashes)]

        expect(uniqueHashes.length).toBe(hashes.length)
      }
    )

    test(
      'Not contain old hashes when loading new page',
      async () => {
        const cspOption = {
          enabled: true,
          policies: {
            'default-src': ['\'self\''],
            'script-src': ['https://example.com', 'https://example.io']
          }
        }
        nuxt = await startCspDevServer(cspOption)
        const { headers: user1Header } = await rp(url('/users/1'))
        const user1Hashes = user1Header[reportOnlyHeader].split(' ').filter(s => s.startsWith('\'sha256-'))

        const { headers: user2Header } = await rp(url('/users/2'))
        const user2Hashes = new Set(user2Header[reportOnlyHeader].split(' ').filter(s => s.startsWith('\'sha256-')))

        const intersection = new Set(user1Hashes.filter(x => user2Hashes.has(x)))
        expect(intersection.size).toBe(0)
      }
    )

    test(
      'Not contain hash when \'unsafe-inline\' option is present in script-src policy',
      async () => {
        const policies = {
          'script-src': ['\'unsafe-inline\'']
        }

        nuxt = await startCspDevServer({
          policies
        })

        for (let i = 0; i < 5; i++) {
          await rp(url('/stateless'))
        }

        const { headers } = await rp(url('/stateful'))

        expect(headers[reportOnlyHeader]).toMatch(/script-src 'self' 'unsafe-inline'$/)
      }
    )

    test(
      'Contain hash and \'unsafe-inline\' when unsafeInlineCompatibility is enabled',
      async () => {
        const policies = {
          'script-src': ['\'unsafe-inline\'']
        }

        nuxt = await startCspServer({
          unsafeInlineCompatibility: true,
          policies
        })

        for (let i = 0; i < 5; i++) {
          await rp(url('/stateless'))
        }

        const { headers } = await rp(url('/stateful'))

        expect(headers[cspHeader]).toMatch(/script-src 'sha256-.*' 'self' 'unsafe-inline'$/)
      }
    )

    // TODO: Remove this test in Nuxt 3, we will stop supporting this typo (more on: https://github.com/nuxt/nuxt.js/pull/6583)
    test(
      'Contain hash and \'unsafe-inline\' when the typo property unsafeInlineCompatiblity is enabled',
      async () => {
        const policies = {
          'script-src': ['\'unsafe-inline\'']
        }

        nuxt = await startCspServer({
          unsafeInlineCompatiblity: true,
          policies
        })

        for (let i = 0; i < 5; i++) {
          await rp(url('/stateless'))
        }

        const { headers } = await rp(url('/stateful'))

        expect(headers[cspHeader]).toMatch(/script-src 'sha256-.*' 'self' 'unsafe-inline'$/)
      }
    )
  })
})
