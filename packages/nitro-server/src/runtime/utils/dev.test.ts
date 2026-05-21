import { describe, expect, it } from 'vitest'
import { generateErrorOverlayHTML } from './dev'

describe('generateErrorOverlayHTML', () => {
  it('emits a storage bridge without Object.hasOwn', () => {
    const overlay = generateErrorOverlayHTML('<html><head></head><body></body></html>')
    const base64HTML = overlay.match(/iframe\.src = 'data:text\/html;base64,([^']+)'/)?.[1]

    expect(base64HTML).toBeTruthy()

    const iframeHTML = Buffer.from(base64HTML!, 'base64').toString('utf8')
    expect(iframeHTML).toContain('Object.prototype.hasOwnProperty.call(memoryStore, key)')
    expect(iframeHTML).not.toContain('Object.hasOwn(')
  })
})
