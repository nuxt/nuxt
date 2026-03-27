import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { resolve } from 'pathe'

import * as runtimeErrorCodes from '../packages/nuxt/src/app/error-codes.ts'
import * as buildErrorCodes from '../packages/kit/src/error-codes.ts'

const docsDir = fileURLToPath(new URL('../docs/errors', import.meta.url))

describe('error codes documentation', () => {
  const runtimeCodes = Object.keys(runtimeErrorCodes).filter(k => /^E\d+$/.test(k))
  const buildCodes = Object.keys(buildErrorCodes).filter(k => /^B\d+$/.test(k))

  it('has at least one runtime error code', () => {
    expect(runtimeCodes.length).toBeGreaterThan(0)
  })

  it('has at least one build error code', () => {
    expect(buildCodes.length).toBeGreaterThan(0)
  })

  for (const code of runtimeCodes) {
    it(`has a docs page for runtime error ${code}`, () => {
      const docPath = resolve(docsDir, `${code}.md`)
      expect(existsSync(docPath), `Missing docs/errors/${code}.md`).toBe(true)
    })
  }

  for (const code of buildCodes) {
    it(`has a docs page for build error ${code}`, () => {
      const docPath = resolve(docsDir, `${code}.md`)
      expect(existsSync(docPath), `Missing docs/errors/${code}.md`).toBe(true)
    })
  }

  it('runtime error code values match their export names', () => {
    for (const code of runtimeCodes) {
      expect(runtimeErrorCodes[code as keyof typeof runtimeErrorCodes], `${code} value should equal its name`).toBe(code)
    }
  })

  it('build error code values match their export names', () => {
    for (const code of buildCodes) {
      expect(buildErrorCodes[code as keyof typeof buildErrorCodes], `${code} value should equal its name`).toBe(code)
    }
  })
})
