import { fileURLToPath } from 'node:url'
import { expect, test } from './test-utils'
import { isWindows } from 'std-env'

test.use({
  nuxt: {
    rootDir: fileURLToPath(new URL('../fixtures/csp', import.meta.url)),
    setupTimeout: (isWindows ? 360 : 120) * 1000,
  },
})

test.describe('Content Security Policy', () => {
  test('has `content-security-policy` header set with default value', async ({ page }) => {
    const resp = await page.goto('/')

    const cspHeaderValue = resp?.headers()['content-security-policy']

    expect(cspHeaderValue).toBeTruthy()

    const nonceValue = cspHeaderValue?.match(/'nonce-(.*?)'/)?.[1]

    expect(cspHeaderValue).toBeTruthy()
    expect(nonceValue).toBeDefined()
    expect(nonceValue).toHaveLength(24)
    expect(cspHeaderValue).toBe(`base-uri 'none'; font-src 'self' https: data:; form-action 'self'; frame-ancestors 'self'; img-src 'self' data:; object-src 'none'; script-src-attr 'none'; style-src 'self' https: 'unsafe-inline'; script-src 'self' https: 'unsafe-inline' 'strict-dynamic' 'nonce-${nonceValue}'; upgrade-insecure-requests;`)
  })

  test('injects `integrity` on Nuxt root scripts and links', async ({ page }) => {
    const expectedIntegrityAttributes = 4 // 3 links, 1 script

    const resp = await page.goto('/')

    const text = await resp?.text()
    const elementsWithIntegrity = text?.match(/ integrity="sha384-/g)?.length ?? 0

    expect(resp).toBeDefined()
    expect(resp).toBeTruthy()
    expect(text).toBeDefined()
    expect(elementsWithIntegrity).toBe(expectedIntegrityAttributes)
  })

  test('injects `nonce` attribute in response', async ({ page }) => {
    const expectedNonceElements = 7 // 1 script in the head, 3 links, 3 scripts in body

    const resp = await page.goto('/')

    const cspHeaderValue = resp?.headers()['content-security-policy']
    const nonce = cspHeaderValue?.match(/'nonce-(.*?)'/)?.[1]

    const text = await resp?.text()
    const nonceMatch = `nonce="${nonce}"`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const elementsWithNonce = text?.match(new RegExp(nonceMatch, 'g'))?.length ?? 0

    expect(resp).toBeDefined()
    expect(resp).toBeTruthy()
    expect(nonce).toBeDefined()
    expect(elementsWithNonce).toBe(expectedNonceElements)
  })

  test('sets CSP via meta http-equiv in SSG mode', async ({ page }) => {
    const expectedIntegrityAttributes = 4 // 3 links (entry, page, build meta), 1 script (entry)
    const expectedInlineScriptHashes = 0
    const expectedExternalScriptHashes = 0
    const expectedInlineStyleHashes = 0
    const expectedExternalStyleHashes = 0

    const resp = await page.goto('/static')

    const body = await resp?.text()

    const { metaTag, csp, elementsWithIntegrity, inlineScriptHashes, externalScriptHashes, inlineStyleHashes, externalStyleHashes } = extractDataFromBody(body!)

    expect(resp).toBeDefined()
    expect(resp).toBeTruthy()
    expect(body).toBeDefined()
    expect(metaTag).toBeDefined()
    expect(csp).toBeDefined()
    expect(elementsWithIntegrity).toBe(expectedIntegrityAttributes)
    expect(inlineScriptHashes).toBe(expectedInlineScriptHashes)
    expect(externalScriptHashes).toBe(expectedExternalScriptHashes)
    expect(inlineStyleHashes).toBe(expectedInlineStyleHashes)
    expect(externalStyleHashes).toBe(expectedExternalStyleHashes)
  })
})

function extractDataFromBody (body: string) {
  const elementsWithIntegrity = body.match(/ integrity="sha384-/g)?.length ?? 0
  const metaTag = body.match(/<meta http-equiv="Content-Security-Policy" content="(.*?)">/)
  const csp = metaTag?.[1]
  const policies = csp?.split(';').map(policy => policy.trimStart()) || []
  const scriptSrcPolicy = policies.find(policy => policy.startsWith('script-src '))
  const scriptSrcValues = scriptSrcPolicy?.split(' ') || []
  const inlineScriptHashes = scriptSrcValues.filter(value => value.startsWith('\'sha256-')).length
  const externalScriptHashes = scriptSrcValues.filter(value => value.startsWith('\'sha384-')).length
  const styleSrcPolicy = policies.find(policy => policy.startsWith('style-src '))
  const styleSrcValues = styleSrcPolicy?.split(' ') || []
  const inlineStyleHashes = styleSrcValues.filter(value => value.startsWith('\'sha256-')).length
  const externalStyleHashes = styleSrcValues.filter(value => value.startsWith('\'sha384-')).length

  return { metaTag, csp, elementsWithIntegrity, inlineScriptHashes, externalScriptHashes, inlineStyleHashes, externalStyleHashes }
}
