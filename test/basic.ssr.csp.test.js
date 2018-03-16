import { resolve } from 'path'

import test from 'ava'
import rp from 'request-promise-native'

import { Nuxt, Builder } from '..'

import { interceptLog } from './helpers/console'

const port = 4005
const url = route => 'http://localhost:' + port + route

// Init nuxt.js and create server listening on localhost:4005
const startCSPTestServer = async (t, csp) => {
  const options = {
    rootDir: resolve(__dirname, 'fixtures/basic'),
    buildDir: '.nuxt-ssr-csp',
    dev: false,
    head: {
      titleTemplate(titleChunk) {
        return titleChunk ? `${titleChunk} - Nuxt.js` : 'Nuxt.js'
      }
    },
    build: { stats: false },
    render: { csp }
  }

  let nuxt = null
  const logSpy = await interceptLog(async () => {
    nuxt = new Nuxt(options)
    const builder = await new Builder(nuxt)
    await builder.build()
    await nuxt.listen(port, '0.0.0.0')
  })

  t.true(logSpy.calledWithMatch('DONE'))
  t.true(logSpy.calledWithMatch('OPEN'))

  return nuxt
}

test.serial('Not contain Content-Security-Policy header, when csp.enabled is not set', async t => {
  const nuxt = await startCSPTestServer(t, {})
  const { headers } = await rp(url('/stateless'), {
    resolveWithFullResponse: true
  })

  t.is(headers['content-security-policy'], undefined)

  await nuxt.close()
})

test.serial('Contain Content-Security-Policy header, when csp.enabled is only set', async t => {
  const cspOption = {
    enabled: true
  }

  const nuxt = await startCSPTestServer(t, cspOption)
  const { headers } = await rp(url('/stateless'), {
    resolveWithFullResponse: true
  })

  t.regex(headers['content-security-policy'], /^script-src 'self' 'sha256-.*'$/)

  await nuxt.close()
})

test.serial('Contain Content-Security-Policy header, when csp.allowedSources set', async t => {
  const cspOption = {
    enabled: true,
    allowedSources: ['https://example.com', 'https://example.io']
  }

  const nuxt = await startCSPTestServer(t, cspOption)
  const { headers } = await rp(url('/stateless'), {
    resolveWithFullResponse: true
  })

  t.regex(headers['content-security-policy'], /^script-src 'self' 'sha256-.*'/)
  t.true(headers['content-security-policy'].includes('https://example.com'))
  t.true(headers['content-security-policy'].includes('https://example.io'))

  await nuxt.close()
})

test.serial('Contain Content-Security-Policy header, when csp.policies set', async t => {
  const cspOption = {
    enabled: true,
    policies: {
      'default-src': [`'none'`],
      'script-src': ['https://example.com', 'https://example.io']
    }
  }

  const nuxt = await startCSPTestServer(t, cspOption)
  const { headers } = await rp(url('/stateless'), {
    resolveWithFullResponse: true
  })

  t.regex(headers['content-security-policy'], /default-src 'none'/)
  t.regex(headers['content-security-policy'], /script-src 'self' 'sha256-.*'/)
  t.true(headers['content-security-policy'].includes('https://example.com'))
  t.true(headers['content-security-policy'].includes('https://example.io'))

  await nuxt.close()
})

test.serial('Contain Content-Security-Policy header, when csp.policies.script-src is not set', async t => {
  const cspOption = {
    enabled: true,
    policies: {
      'default-src': [`'none'`]
    }
  }

  const nuxt = await startCSPTestServer(t, cspOption)
  const { headers } = await rp(url('/stateless'), {
    resolveWithFullResponse: true
  })

  t.regex(headers['content-security-policy'], /default-src 'none'/)
  t.regex(headers['content-security-policy'], /script-src 'self' 'sha256-.*'/)

  await nuxt.close()
})
