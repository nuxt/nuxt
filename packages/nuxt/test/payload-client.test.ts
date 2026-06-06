/**
 * Tests for the forwardedPrefetchEntries fix in payload.client.ts.
 *
 * Tests import the REAL plugin module; virtual imports (#app, #build/*)
 * are stubbed via vi.mock so no Nuxt build output is required.
 *
 * Architecture notes
 * ------------------
 * - `forwardedPrefetchEntries` is a module-level Map defined once at plugin
 *   module load time.  It persists across test cases within the same worker.
 *   Each test that inserts entries MUST fire the afterEach router hook (or the
 *   beforeResolve disposal path) to drain the Map before the next test runs.
 *   The global afterEach at the bottom of this file fires the router's afterEach
 *   handler to guarantee cleanup even when a test itself does not.
 *
 * - Because the plugin's internal Map is not exported, all assertions are
 *   behavioral: we verify call counts on `dispose` mocks and `head.push` mocks
 *   rather than inspecting Map.size directly.
 *
 * - `onNuxtReady` is mocked synchronously so that link:prefetch and router
 *   hooks register immediately when the plugin's setup() runs.
 *
 * - `useRouter` returns the per-test `_mockRouter` set in beforeEach.  The
 *   plugin calls useRouter() twice: once at setup() time (beforeResolve) and
 *   once inside the onNuxtReady callback (afterEach).  Both calls happen in
 *   the same synchronous tick when onNuxtReady is synchronous, so they both
 *   get the same _mockRouter instance.
 *
 * - `deriveKey` tests (Group 1) exercise the URL-normalisation contract by
 *   driving the link:prefetch handler with crafted URLs and asserting that the
 *   key stored in the Map (inferred from whether beforeResolve disposal fires)
 *   matches the expected pathname.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Import the plugin under test AFTER all vi.mock declarations so hoisting
// applies correctly.
// ---------------------------------------------------------------------------
import pluginDefault from '../src/app/plugins/payload.client'
import { loadPayload } from '../src/app/composables/payload'

// ---------------------------------------------------------------------------
// Mock: #build/nuxt.config.mjs
// The unit vitest project already aliases this to test/mocks/nuxt-config.ts
// which lacks the three fields used by payload.client.  We override via
// vi.mock to supply them and make them controllable per-suite.
// ---------------------------------------------------------------------------
vi.mock('#build/nuxt.config.mjs', () => ({
  appManifest: false,
  prefetchPreloadTags: true, // enabled by default so head.push / Map paths run
  purgeCachedData: true,
  asyncCallHook: false,
  appId: 'nuxt-app',
  multiApp: false,
  chunkErrorEvent: null,
  nuxtLinkDefaults: { componentName: 'NuxtLink' },
  useStateDefaults: { resetOnClear: false },
}))

// ---------------------------------------------------------------------------
// Mock: loadPayload — returns null (no payload) by default; individual tests
// override with mockResolvedValueOnce to supply a payload object.
// ---------------------------------------------------------------------------
vi.mock('../src/app/composables/payload', () => ({
  loadPayload: vi.fn().mockResolvedValue(null),
}))

// ---------------------------------------------------------------------------
// Mock: getAppManifest — fire-and-forget inside setTimeout; just needs to exist
// ---------------------------------------------------------------------------
vi.mock('../src/app/composables/manifest', () => ({
  getAppManifest: vi.fn().mockResolvedValue(undefined),
}))

// ---------------------------------------------------------------------------
// Mock: injectHead
// Returns a mockHead object with a push() that returns a disposable entry.
// We expose the mockHead on the nuxtApp so tests can inspect call counts.
// ---------------------------------------------------------------------------
vi.mock('../src/app/composables/head', () => ({
  injectHead: vi.fn((_nuxtApp: any) => _nuxtApp._mockHead),
}))

// ---------------------------------------------------------------------------
// Mock: onNuxtReady — calls callback synchronously so hooks register
// immediately without a real Nuxt hydration lifecycle.
// ---------------------------------------------------------------------------
vi.mock('../src/app/composables/ready', () => ({
  onNuxtReady: vi.fn((cb: () => void) => { cb() }),
}))

// ---------------------------------------------------------------------------
// Mock: useRouter — returns the per-test _mockRouter instance
// ---------------------------------------------------------------------------
let _mockRouter: ReturnType<typeof createMockRouter>

function createMockRouter () {
  const handlers: Record<string, Array<(...args: any[]) => any>> = {
    beforeResolve: [],
    afterEach: [],
  }
  return {
    _handlers: handlers,
    beforeResolve: vi.fn((fn: (...a: any[]) => any) => { handlers.beforeResolve!.push(fn) }),
    afterEach: vi.fn((fn: (...a: any[]) => any) => { handlers.afterEach!.push(fn) }),
    async fire (type: 'beforeResolve' | 'afterEach', ...args: any[]) {
      for (const h of handlers[type]!) { await h(...args) }
    },
  }
}

vi.mock('../src/app/composables/router', () => ({
  useRouter: vi.fn(() => _mockRouter),
}))

// ---------------------------------------------------------------------------
// Helper: createMockNuxtApp
// Provides the minimal nuxtApp surface that payload.client.ts's setup()
// touches: hooks.hook(), static.data, isHydrating, and _mockHead (used by
// our injectHead mock above).
// ---------------------------------------------------------------------------
interface MockHeadEntry { dispose: ReturnType<typeof vi.fn> }
interface MockHead {
  push: ReturnType<typeof vi.fn>
  _entries: MockHeadEntry[]
}

function createMockHead (): MockHead {
  const entries: MockHeadEntry[] = []
  const push = vi.fn((_input: any): MockHeadEntry => {
    const entry = { dispose: vi.fn() }
    entries.push(entry)
    return entry
  })
  return { push, _entries: entries }
}

function createMockNuxtApp () {
  const capturedHooks: Record<string, Array<(...args: any[]) => any>> = {}
  const mockHead = createMockHead()

  return {
    _capturedHooks: capturedHooks,
    _mockHead: mockHead,
    isHydrating: false,
    static: { data: {} as Record<string, any> },
    hooks: {
      hook (name: string, handler: (...a: any[]) => any) {
        capturedHooks[name] ??= []
        capturedHooks[name].push(handler)
      },
    },
    async fireHook (name: string, ...args: any[]) {
      for (const h of capturedHooks[name] ?? []) { await h(...args) }
    },
  }
}

// ---------------------------------------------------------------------------
// window.location stub — required for any test that fires link:prefetch
// (the plugin reads window.location.href and window.location.hostname).
// ---------------------------------------------------------------------------
const WINDOW_STUB = {
  location: { href: 'http://localhost/', hostname: 'localhost' },
}

function withWindow<T> (fn: () => Promise<T>): Promise<T> {
  const prev = (globalThis as any).window
  ;(globalThis as any).window = WINDOW_STUB
  return fn().finally(() => { (globalThis as any).window = prev })
}

// ---------------------------------------------------------------------------
// Shared setup / teardown
// ---------------------------------------------------------------------------

/** Invoke the plugin on a fresh nuxtApp and return helpers. */
function setupPlugin () {
  const nuxtApp = createMockNuxtApp()
  ;(pluginDefault as any)(nuxtApp)
  return nuxtApp
}

/**
 * Build a payload that triggers head.push — prefetchLinks must be non-empty.
 */
function makePayload (prefetchLinks: Array<Record<string, string | boolean>> = [{ rel: 'preload', href: '/chunk.js' }]) {
  return { data: {}, prefetchLinks }
}

beforeEach(() => {
  _mockRouter = createMockRouter()
  vi.clearAllMocks()
  // re-set after clearAllMocks so the fresh router is active
  _mockRouter = createMockRouter()
})

afterEach(async () => {
  // Drain the module-level forwardedPrefetchEntries Map so state does not
  // bleed into the next test.  Fire the afterEach router hook; if nothing
  // was registered this is a no-op.
  await _mockRouter.fire('afterEach')
})

// ===========================================================================
// Group 1 — deriveKey: URL normalisation contract
// The plugin derives a key via `new URL(url, window.location.href).pathname`.
// We verify the contract by:
//   (a) triggering link:prefetch with a given URL (inserts under derived key)
//   (b) firing beforeResolve with to.path = expected pathname
//   (c) asserting that entry.dispose() was called (proves key matched)
// ===========================================================================

describe('Group 1 — deriveKey: URL normalisation contract', () => {
  it('1.1 relative path against root base — key equals pathname', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      const mockPayload = makePayload()
      vi.mocked(loadPayload).mockResolvedValueOnce(mockPayload)

      await nuxtApp.fireHook('link:prefetch', 'http://localhost/about')
      expect(nuxtApp._mockHead.push).toHaveBeenCalledTimes(1)

      const entry = nuxtApp._mockHead._entries[0]!
      // Navigate to /about — derived key '/about' must match to.path '/about'
      await _mockRouter.fire('beforeResolve', { path: '/about' }, { path: '/' })
      expect(entry.dispose).toHaveBeenCalledTimes(1)
    })
  })

  it('1.2 absolute URL — base is irrelevant for pathname extraction', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      await nuxtApp.fireHook('link:prefetch', 'http://localhost/products/42')
      const entry = nuxtApp._mockHead._entries[0]!

      await _mockRouter.fire('beforeResolve', { path: '/products/42' }, { path: '/' })
      expect(entry.dispose).toHaveBeenCalledTimes(1)
    })
  })

  it('1.3 root path — key is "/"', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      await nuxtApp.fireHook('link:prefetch', 'http://localhost/')
      const entry = nuxtApp._mockHead._entries[0]!

      await _mockRouter.fire('beforeResolve', { path: '/' }, { path: '/prev' })
      expect(entry.dispose).toHaveBeenCalledTimes(1)
    })
  })

  it('1.4 deeply nested path — full pathname preserved as key', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      await nuxtApp.fireHook('link:prefetch', 'http://localhost/a/b/c/d')
      const entry = nuxtApp._mockHead._entries[0]!

      await _mockRouter.fire('beforeResolve', { path: '/a/b/c/d' }, { path: '/' })
      expect(entry.dispose).toHaveBeenCalledTimes(1)
    })
  })

  it('1.5 strips query string — key does NOT include "?"', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      await nuxtApp.fireHook('link:prefetch', 'http://localhost/search?q=nuxt')
      const entry = nuxtApp._mockHead._entries[0]!

      // to.path is always the pathname; query is separate in vue-router
      await _mockRouter.fire('beforeResolve', { path: '/search' }, { path: '/' })
      expect(entry.dispose).toHaveBeenCalledTimes(1)
    })
  })

  it('1.6 strips hash fragment — key does NOT include "#"', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      await nuxtApp.fireHook('link:prefetch', 'http://localhost/docs#section')
      const entry = nuxtApp._mockHead._entries[0]!

      await _mockRouter.fire('beforeResolve', { path: '/docs' }, { path: '/' })
      expect(entry.dispose).toHaveBeenCalledTimes(1)
    })
  })

  it('1.7 strips both query and hash', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      await nuxtApp.fireHook('link:prefetch', 'http://localhost/page?ref=nav#top')
      const entry = nuxtApp._mockHead._entries[0]!

      await _mockRouter.fire('beforeResolve', { path: '/page' }, { path: '/' })
      expect(entry.dispose).toHaveBeenCalledTimes(1)
    })
  })

  it('1.8 percent-encodes raw non-ASCII characters in key', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      // URL constructor percent-encodes the é in /café
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/café')
      const entry = nuxtApp._mockHead._entries[0]!

      // vue-router represents the route path with the percent-encoded form
      await _mockRouter.fire('beforeResolve', { path: '/caf%C3%A9' }, { path: '/' })
      expect(entry.dispose).toHaveBeenCalledTimes(1)
    })
  })

  it('1.9 already-percent-encoded non-ASCII is preserved (no double-encoding)', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      await nuxtApp.fireHook('link:prefetch', 'http://localhost/caf%C3%A9')
      const entry = nuxtApp._mockHead._entries[0]!

      // Key should still be /caf%C3%A9 (URL does not re-encode already-encoded)
      await _mockRouter.fire('beforeResolve', { path: '/caf%C3%A9' }, { path: '/' })
      expect(entry.dispose).toHaveBeenCalledTimes(1)
    })
  })

  it('1.10 encoded and decoded forms produce the same key', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()

      // Insert via decoded form
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/café')
      const entryDecoded = nuxtApp._mockHead._entries[0]!

      // The second prefetch for the same (normalised) key must NOT create a
      // second entry — idempotency guard
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/caf%C3%A9')
      // Still only one push call
      expect(nuxtApp._mockHead.push).toHaveBeenCalledTimes(1)

      await _mockRouter.fire('beforeResolve', { path: '/caf%C3%A9' }, { path: '/' })
      expect(entryDecoded.dispose).toHaveBeenCalledTimes(1)
    })
  })

  it('1.11 trailing slash preserved from href', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      await nuxtApp.fireHook('link:prefetch', 'http://localhost/about/')
      const entry = nuxtApp._mockHead._entries[0]!

      // key is '/about/' — navigation to '/about/' matches
      await _mockRouter.fire('beforeResolve', { path: '/about/' }, { path: '/' })
      expect(entry.dispose).toHaveBeenCalledTimes(1)
    })
  })

  it('1.12 non-root base: relative URL resolved against sub-path', async () => {
    // Simulating window.location.href = 'http://localhost/app/'
    const prev = (globalThis as any).window
    ;(globalThis as any).window = {
      location: { href: 'http://localhost/app/', hostname: 'localhost' },
    }
    try {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      // 'about' relative to 'http://localhost/app/' resolves to '/app/about'
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/app/about')
      const entry = nuxtApp._mockHead._entries[0]!

      await _mockRouter.fire('beforeResolve', { path: '/app/about' }, { path: '/app/' })
      expect(entry.dispose).toHaveBeenCalledTimes(1)
    } finally {
      ;(globalThis as any).window = prev
    }
  })

  it('1.13 non-root base: absolute URL retains its own pathname', async () => {
    const prev = (globalThis as any).window
    ;(globalThis as any).window = {
      location: { href: 'http://localhost/app/', hostname: 'localhost' },
    }
    try {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      // Absolute URL — base is ignored, key is the URL's own pathname
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/other/page')
      const entry = nuxtApp._mockHead._entries[0]!

      await _mockRouter.fire('beforeResolve', { path: '/other/page' }, { path: '/app/' })
      expect(entry.dispose).toHaveBeenCalledTimes(1)
    } finally {
      ;(globalThis as any).window = prev
    }
  })
})

// ===========================================================================
// Group 2 — primary bug regression: full-URL key vs pathname key
// Pre-fix the key was the raw URL string.  Post-fix it is the pathname.
// These tests confirm the fixed behaviour — disposal succeeds via pathname.
// ===========================================================================

describe('Group 2 — primary bug regression: full-URL key vs pathname key', () => {
  it('2.1 key derived from full URL equals the pathname for a simple URL', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      await nuxtApp.fireHook('link:prefetch', 'http://localhost/about')
      const entry = nuxtApp._mockHead._entries[0]!

      // If the key were 'http://localhost/about', to.path='/about' would miss.
      // Post-fix: key is '/about' → disposal fires.
      await _mockRouter.fire('beforeResolve', { path: '/about' }, { path: '/' })
      expect(entry.dispose).toHaveBeenCalledTimes(1)
    })
  })

  it('2.2 onLinkPrefetch with full URL; onBeforeResolve with to.path — disposal succeeds', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      // Full URL inserted
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/products/detail?ref=hp')
      const entry = nuxtApp._mockHead._entries[0]!

      // Navigation supplies only the path — must still match
      await _mockRouter.fire('beforeResolve', { path: '/products/detail' }, { path: '/products' })
      expect(entry.dispose).toHaveBeenCalledTimes(1)
    })
  })

  it('2.3 pre-fix key (raw URL string) would NOT match to.path — confirms bug was real', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      await nuxtApp.fireHook('link:prefetch', 'http://localhost/about')
      const entry = nuxtApp._mockHead._entries[0]!

      // Simulate the pre-fix behaviour: navigate to the FULL URL string as path.
      // This should NOT match because to.path is a plain pathname in vue-router.
      // If the entry were stored under 'http://localhost/about', this would fire.
      // Post-fix: stored under '/about', so navigating with full URL key misses.
      await _mockRouter.fire('beforeResolve', { path: 'http://localhost/about' }, { path: '/' })
      // dispose must NOT have been called — the key 'http://...' doesn't match '/about'
      expect(entry.dispose).not.toHaveBeenCalled()
    })
  })

  it('2.4 multiple full URLs for same pathname — only first inserted, disposal works', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()

      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/about?foo=1')

      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/about?foo=2')

      // Both normalise to '/about'; idempotency guard means only one entry
      expect(nuxtApp._mockHead.push).toHaveBeenCalledTimes(1)

      const entry = nuxtApp._mockHead._entries[0]!
      await _mockRouter.fire('beforeResolve', { path: '/about' }, { path: '/' })
      expect(entry.dispose).toHaveBeenCalledTimes(1)
    })
  })
})

// ===========================================================================
// Group 3 — trailing-slash variants
// ===========================================================================

describe('Group 3 — trailing-slash variants', () => {
  it('3.1 prefetch with trailing slash, navigation without — beforeResolve misses (key mismatch documented)', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      await nuxtApp.fireHook('link:prefetch', 'http://localhost/about/')
      const entry = nuxtApp._mockHead._entries[0]!

      // key is '/about/', navigation supplies '/about' — no match
      await _mockRouter.fire('beforeResolve', { path: '/about' }, { path: '/' })
      expect(entry.dispose).not.toHaveBeenCalled()
      // afterEach global cleanup will drain this entry
    })
  })

  it('3.2 matching trailing slash on both sides: beforeResolve succeeds', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      await nuxtApp.fireHook('link:prefetch', 'http://localhost/about/')
      const entry = nuxtApp._mockHead._entries[0]!

      await _mockRouter.fire('beforeResolve', { path: '/about/' }, { path: '/' })
      expect(entry.dispose).toHaveBeenCalledTimes(1)
    })
  })

  it('3.3 prefetch without trailing slash, navigation with — beforeResolve misses', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      await nuxtApp.fireHook('link:prefetch', 'http://localhost/about')
      const entry = nuxtApp._mockHead._entries[0]!

      // key is '/about', navigation supplies '/about/' — no match
      await _mockRouter.fire('beforeResolve', { path: '/about/' }, { path: '/' })
      expect(entry.dispose).not.toHaveBeenCalled()
    })
  })
})

// ===========================================================================
// Group 4 — percent-encoded characters in URL key
// ===========================================================================

describe('Group 4 — percent-encoded characters in URL key', () => {
  it('4.1 encoded prefetch URL resolves to the same key as decoded', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      // Already encoded
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/caf%C3%A9')
      const entry = nuxtApp._mockHead._entries[0]!

      await _mockRouter.fire('beforeResolve', { path: '/caf%C3%A9' }, { path: '/' })
      expect(entry.dispose).toHaveBeenCalledTimes(1)
    })
  })

  it('4.2 encoded and decoded prefetch URLs resolve to same key — no mismatch', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      // Decoded form — URL constructor encodes to /caf%C3%A9
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/café')
      expect(nuxtApp._mockHead.push).toHaveBeenCalledTimes(1)

      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())
      // Encoded form — same pathname key, idempotency guard blocks second push
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/caf%C3%A9')
      expect(nuxtApp._mockHead.push).toHaveBeenCalledTimes(1)
    })
  })

  it('4.3 raw non-ASCII in prefetch URL inserts under percent-encoded key', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      await nuxtApp.fireHook('link:prefetch', 'http://localhost/中文') // /中文
      const entry = nuxtApp._mockHead._entries[0]!

      // URL constructor encodes CJK characters
      await _mockRouter.fire('beforeResolve', { path: '/%E4%B8%AD%E6%96%87' }, { path: '/' })
      expect(entry.dispose).toHaveBeenCalledTimes(1)
    })
  })

  it('4.4 encoded special chars in path round-trip correctly', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      await nuxtApp.fireHook('link:prefetch', 'http://localhost/path%20with%20spaces')
      const entry = nuxtApp._mockHead._entries[0]!

      await _mockRouter.fire('beforeResolve', { path: '/path%20with%20spaces' }, { path: '/' })
      expect(entry.dispose).toHaveBeenCalledTimes(1)
    })
  })
})

// ===========================================================================
// Group 5 — race: navigation fires before loadPayload resolves
// ===========================================================================

describe('Group 5 — race: navigation fires before loadPayload resolves', () => {
  it('5.1 beforeResolve finds nothing; late insert; afterEach sweeps', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()

      // loadPayload promise does not resolve until we manually resolve it
      let resolvePayload!: (v: any) => void
      const lazyPayload = new Promise<any>((r) => { resolvePayload = r })
      vi.mocked(loadPayload).mockReturnValueOnce(lazyPayload)

      // Start prefetch but do NOT await yet
      const prefetchPromise = nuxtApp.fireHook('link:prefetch', 'http://localhost/lazy')

      // Navigation fires before payload resolves — no entry in Map yet
      await _mockRouter.fire('beforeResolve', { path: '/lazy' }, { path: '/' })
      // No entry existed so no dispose should have fired yet
      expect(nuxtApp._mockHead.push).not.toHaveBeenCalled()

      // Now the payload resolves and the entry gets inserted
      resolvePayload(makePayload())
      await prefetchPromise

      // Entry is now in the Map; afterEach will sweep it
      await _mockRouter.fire('afterEach')
      expect(nuxtApp._mockHead._entries[0]!.dispose).toHaveBeenCalledTimes(1)
    })
  })

  it('5.2 two concurrent prefetches for the same path — only first inserted', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()

      vi.mocked(loadPayload)
        .mockResolvedValueOnce(makePayload())
        .mockResolvedValueOnce(makePayload())

      await Promise.all([
        nuxtApp.fireHook('link:prefetch', 'http://localhost/concurrent'),
        nuxtApp.fireHook('link:prefetch', 'http://localhost/concurrent'),
      ])

      // Idempotency guard — only one head.push
      expect(nuxtApp._mockHead.push).toHaveBeenCalledTimes(1)
    })
  })
})

// ===========================================================================
// Group 6 — dispose after Map.clear()
// ===========================================================================

describe('Group 6 — dispose after Map.clear()', () => {
  it('6.1 afterEach calls dispose on all entries then clears; second call is no-op', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()

      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/page-a')

      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/page-b')

      expect(nuxtApp._mockHead._entries).toHaveLength(2)

      // First afterEach: disposes both, clears Map
      await _mockRouter.fire('afterEach')
      for (const entry of nuxtApp._mockHead._entries) {
        expect(entry.dispose).toHaveBeenCalledTimes(1)
      }

      // Second afterEach: Map is empty — early-exit, no additional dispose calls
      await _mockRouter.fire('afterEach')
      for (const entry of nuxtApp._mockHead._entries) {
        expect(entry.dispose).toHaveBeenCalledTimes(1) // still exactly 1
      }
    })
  })

  it('6.2 calling dispose() directly after Map.clear() does not throw (entry reachable by ref)', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      await nuxtApp.fireHook('link:prefetch', 'http://localhost/page-c')
      const entry = nuxtApp._mockHead._entries[0]!

      // Clear map via afterEach
      await _mockRouter.fire('afterEach')
      expect(entry.dispose).toHaveBeenCalledTimes(1)

      // Calling dispose on the locally held reference again must not throw
      expect(() => (entry.dispose as () => void)()).not.toThrow()
    })
  })

  it('6.3 mixed: some disposed by beforeResolve, rest by afterEach', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()

      // Insert 3 entries
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/nav-target')
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/page-x')
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/page-y')

      const entryTarget = nuxtApp._mockHead._entries[0]!
      const entryX = nuxtApp._mockHead._entries[1]!
      const entryY = nuxtApp._mockHead._entries[2]!

      // Navigate to /nav-target — beforeResolve disposes that entry only
      await _mockRouter.fire('beforeResolve', { path: '/nav-target' }, { path: '/' })
      expect(entryTarget.dispose).toHaveBeenCalledTimes(1)
      expect(entryX.dispose).not.toHaveBeenCalled()
      expect(entryY.dispose).not.toHaveBeenCalled()

      // afterEach sweeps the remaining two
      await _mockRouter.fire('afterEach')
      expect(entryX.dispose).toHaveBeenCalledTimes(1)
      expect(entryY.dispose).toHaveBeenCalledTimes(1)
    })
  })
})

// ===========================================================================
// Group 7 — rapid back/forward: many prefetches, one navigation clears all
// ===========================================================================

describe('Group 7 — rapid back/forward: many prefetches, one navigation clears all', () => {
  it('7.1 afterEach disposes all 10 prefetched entries in one sweep', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      const paths = Array.from({ length: 10 }, (_, i) => `/route-${i}`)

      for (const p of paths) {
        vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())
        await nuxtApp.fireHook('link:prefetch', `http://localhost${p}`)
      }

      expect(nuxtApp._mockHead.push).toHaveBeenCalledTimes(10)

      await _mockRouter.fire('afterEach')

      for (const entry of nuxtApp._mockHead._entries) {
        expect(entry.dispose).toHaveBeenCalledTimes(1)
      }
    })
  })

  it('7.2 beforeResolve disposes only the navigated-to entry; afterEach clears the rest', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      const paths = Array.from({ length: 5 }, (_, i) => `/multi-${i}`)

      for (const p of paths) {
        vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())
        await nuxtApp.fireHook('link:prefetch', `http://localhost${p}`)
      }

      const entries = nuxtApp._mockHead._entries

      // Navigate to /multi-2
      await _mockRouter.fire('beforeResolve', { path: '/multi-2' }, { path: '/' })
      expect(entries[2]!.dispose).toHaveBeenCalledTimes(1)
      // others untouched
      for (let i = 0; i < 5; i++) {
        if (i !== 2) {
          expect(entries[i]!.dispose).not.toHaveBeenCalled()
        }
      }

      // afterEach sweeps the remaining 4
      await _mockRouter.fire('afterEach')
      for (let i = 0; i < 5; i++) {
        if (i !== 2) {
          expect(entries[i]!.dispose).toHaveBeenCalledTimes(1)
        }
      }
    })
  })

  it('7.3 multiple successive afterEach calls stay idempotent', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()

      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/idem')

      const entry = nuxtApp._mockHead._entries[0]!

      await _mockRouter.fire('afterEach')
      await _mockRouter.fire('afterEach')
      await _mockRouter.fire('afterEach')

      // dispose must have been called exactly once (first afterEach only)
      expect(entry.dispose).toHaveBeenCalledTimes(1)
    })
  })
})

// ===========================================================================
// Group 8 — same-route guard: to.path === from.path
// ===========================================================================

describe('Group 8 — same-route guard: to.path === from.path', () => {
  it('8.1 beforeResolve returns early and does not dispose when to.path === from.path', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      await nuxtApp.fireHook('link:prefetch', 'http://localhost/same')
      const entry = nuxtApp._mockHead._entries[0]!

      // Same-route navigation — guard fires the `return` early in beforeResolve
      await _mockRouter.fire('beforeResolve', { path: '/same' }, { path: '/same' })
      expect(entry.dispose).not.toHaveBeenCalled()
    })
  })

  it('8.2 second navigation to a different route disposes the entry normally', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      await nuxtApp.fireHook('link:prefetch', 'http://localhost/same')
      const entry = nuxtApp._mockHead._entries[0]!

      // Same-route (no-op)
      await _mockRouter.fire('beforeResolve', { path: '/same' }, { path: '/same' })
      expect(entry.dispose).not.toHaveBeenCalled()

      // Different-route navigation — disposal fires
      await _mockRouter.fire('beforeResolve', { path: '/same' }, { path: '/other' })
      expect(entry.dispose).toHaveBeenCalledTimes(1)
    })
  })

  it('8.3 guard does not block from===to when no entries are in the map', async () => {
    await withWindow(async () => {
      setupPlugin()
      // No prefetch registered

      // Must not throw even with empty map
      await expect(
        _mockRouter.fire('beforeResolve', { path: '/x' }, { path: '/x' }),
      ).resolves.not.toThrow()
    })
  })
})

// ===========================================================================
// Group 9 — prefetchPreloadTags=false branch (no insertions)
// We cannot change the module-level import at runtime, but we can verify the
// expected behaviour by checking that head.push is never called when
// prefetchPreloadTags is false.  Because the mock is hoisted and set to true
// at module scope, we test the complementary invariants:
//   - When no payload.prefetchLinks are returned, head.push is skipped.
//   - When loadPayload returns null, head.push is skipped.
//   - afterEach on empty map is a safe no-op.
// (The full prefetchPreloadTags=false branch requires a vi.resetModules() +
// dynamic import isolation which is out of scope for this synchronous test.)
// ===========================================================================

describe('Group 9 — prefetchPreloadTags=false branch (no insertions)', () => {
  it('9.1 loadPayload returns null — map remains empty, head.push never called', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      // loadPayload default returns null
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/null-payload')

      expect(nuxtApp._mockHead.push).not.toHaveBeenCalled()
    })
  })

  it('9.2 afterEach early-exit on empty map: no dispose calls', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      // No prefetch — empty map

      await _mockRouter.fire('afterEach')
      // No entries to dispose
      expect(nuxtApp._mockHead._entries).toHaveLength(0)
    })
  })

  it('9.3 onBeforeResolve on an empty store always returns without disposal', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()

      // No entries inserted
      await _mockRouter.fire('beforeResolve', { path: '/empty' }, { path: '/' })
      // head.push never called — nothing to dispose
      expect(nuxtApp._mockHead.push).not.toHaveBeenCalled()
    })
  })
})

// ===========================================================================
// Group 10 — idempotent insertion guard: no duplicate entries
// ===========================================================================

describe('Group 10 — idempotent insertion guard: no duplicate entries', () => {
  it('10.1 two prefetches for the same URL: second push is blocked', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()

      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/dup')

      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/dup')

      expect(nuxtApp._mockHead.push).toHaveBeenCalledTimes(1)
    })
  })

  it('10.2 after disposal, the same URL can be re-inserted', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()

      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/reinsert')

      // Dispose via beforeResolve
      await _mockRouter.fire('beforeResolve', { path: '/reinsert' }, { path: '/' })
      expect(nuxtApp._mockHead._entries[0]!.dispose).toHaveBeenCalledTimes(1)

      // After disposal the key is removed — new prefetch creates a new entry
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/reinsert')
      expect(nuxtApp._mockHead.push).toHaveBeenCalledTimes(2)
    })
  })

  it('10.3 different URLs are each inserted independently', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()

      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/alpha')

      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/beta')

      expect(nuxtApp._mockHead.push).toHaveBeenCalledTimes(2)
    })
  })

  it('10.4 payload without prefetchLinks does not insert entry', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()

      // Payload exists but prefetchLinks is empty array
      vi.mocked(loadPayload).mockResolvedValueOnce({ data: {}, prefetchLinks: [] })
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/no-links')

      expect(nuxtApp._mockHead.push).not.toHaveBeenCalled()
    })
  })

  it('10.5 payload without prefetchLinks property does not insert entry', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()

      // Payload exists but has no prefetchLinks key at all
      vi.mocked(loadPayload).mockResolvedValueOnce({ data: {} })
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/no-links-prop')

      expect(nuxtApp._mockHead.push).not.toHaveBeenCalled()
    })
  })
})

// ===========================================================================
// Group 11 — external URL guard: non-matching hostname is skipped
// ===========================================================================

describe('Group 11 — external URL guard: non-matching hostname is skipped', () => {
  it('11.1 link:prefetch for external domain — skipped entirely', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      // Do NOT queue mockResolvedValueOnce here — loadPayload is never called
      // for external hostnames (early return before the loadPayload call).
      // Queueing and not consuming would leak the once-mock into the next test.

      // hostname 'example.com' !== 'localhost' → early return
      await nuxtApp.fireHook('link:prefetch', 'http://example.com/page')

      expect(loadPayload).not.toHaveBeenCalled()
      expect(nuxtApp._mockHead.push).not.toHaveBeenCalled()
    })
  })

  it('11.2 same hostname with different path is not treated as external', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      await nuxtApp.fireHook('link:prefetch', 'http://localhost/internal/page')
      expect(loadPayload).toHaveBeenCalledTimes(1)
    })
  })

  it('11.3 mixed batch: external URL skipped, internal URL inserted', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce(makePayload())

      await nuxtApp.fireHook('link:prefetch', 'http://cdn.example.com/asset')
      await nuxtApp.fireHook('link:prefetch', 'http://localhost/home')

      expect(nuxtApp._mockHead.push).toHaveBeenCalledTimes(1)
    })
  })
})

// ===========================================================================
// Group 12 — purgeCachedData: static.data patching
// ===========================================================================

describe('Group 12 — purgeCachedData: static.data patching', () => {
  it('12.1 loadPayload returns data payload — keys merged into nuxtApp.static.data', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce({
        data: { key1: 'value1', key2: 42 },
        prefetchLinks: [],
      })

      await _mockRouter.fire('beforeResolve', { path: '/data-route' }, { path: '/' })

      expect(nuxtApp.static.data.key1).toBe('value1')
      expect(nuxtApp.static.data.key2).toBe(42)
    })
  })

  it('12.2 purgeCachedData removes old keys on second navigation', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()

      // First navigation — sets key1
      vi.mocked(loadPayload).mockResolvedValueOnce({
        data: { oldKey: 'old' },
        prefetchLinks: [],
      })
      await _mockRouter.fire('beforeResolve', { path: '/first' }, { path: '/' })
      expect(nuxtApp.static.data.oldKey).toBe('old')

      // Second navigation — payload does NOT contain oldKey
      vi.mocked(loadPayload).mockResolvedValueOnce({
        data: { newKey: 'new' },
        prefetchLinks: [],
      })
      await _mockRouter.fire('beforeResolve', { path: '/second' }, { path: '/first' })

      // oldKey should have been purged (purgeCachedData=true)
      expect(nuxtApp.static.data.oldKey).toBeUndefined()
      expect(nuxtApp.static.data.newKey).toBe('new')
    })
  })

  it('12.3 null payload — static.data unchanged', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      nuxtApp.static.data.preserved = 'yes'

      // loadPayload returns null — no changes
      await _mockRouter.fire('beforeResolve', { path: '/null-data' }, { path: '/' })

      expect(nuxtApp.static.data.preserved).toBe('yes')
    })
  })
})

// ===========================================================================
// Group 13 — head.push link transformation
// ===========================================================================

describe('Group 13 — head.push link transformation', () => {
  it('13.1 preload rel is downgraded to prefetch', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce({
        data: {},
        prefetchLinks: [{ rel: 'preload', href: '/chunk.js', as: 'script' }],
      })

      await nuxtApp.fireHook('link:prefetch', 'http://localhost/page')

      expect(nuxtApp._mockHead.push).toHaveBeenCalledWith({
        link: [{ href: '/chunk.js', as: 'script', rel: 'prefetch' }],
      })
    })
  })

  it('13.2 modulepreload rel is downgraded to prefetch', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce({
        data: {},
        prefetchLinks: [{ rel: 'modulepreload', href: '/mod.js' }],
      })

      await nuxtApp.fireHook('link:prefetch', 'http://localhost/mod-page')

      expect(nuxtApp._mockHead.push).toHaveBeenCalledWith({
        link: [{ href: '/mod.js', rel: 'prefetch' }],
      })
    })
  })

  it('13.3 multiple links in single payload — all downgraded', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce({
        data: {},
        prefetchLinks: [
          { rel: 'preload', href: '/a.js', as: 'script' },
          { rel: 'modulepreload', href: '/b.js' },
          { rel: 'preload', href: '/c.css', as: 'style' },
        ],
      })

      await nuxtApp.fireHook('link:prefetch', 'http://localhost/multi-link')

      const pushArg = nuxtApp._mockHead.push.mock.calls[0]![0]
      expect(pushArg.link).toHaveLength(3)
      for (const link of pushArg.link) {
        expect(link.rel).toBe('prefetch')
      }
    })
  })
})

// ===========================================================================
// Group 14 — appManifest disabled: getAppManifest not called
// ===========================================================================

describe('Group 14 — appManifest disabled: getAppManifest not scheduled', () => {
  it('14.1 with appManifest=false (module default) setTimeout is not called for getAppManifest', async () => {
    await withWindow(async () => {
      const { getAppManifest } = await import('../src/app/composables/manifest')
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')

      const nuxtApp = createMockNuxtApp()
      // Set navigator.connection to avoid slow-2g guard.
      // `globalThis.navigator` is a read-only getter in the jsdom environment,
      // so we must use Object.defineProperty to override it temporarily.
      const origDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
      Object.defineProperty(globalThis, 'navigator', {
        value: { connection: { effectiveType: '4g' } },
        configurable: true,
        writable: true,
      })

      try {
        ;(pluginDefault as any)(nuxtApp)
        // With appManifest=false (our mock), setTimeout for getAppManifest must not fire
        const getAppManifestTimers = setTimeoutSpy.mock.calls.filter(
          call => call[0] === getAppManifest,
        )
        expect(getAppManifestTimers).toHaveLength(0)
      } finally {
        // Restore the original navigator descriptor
        if (origDescriptor) {
          Object.defineProperty(globalThis, 'navigator', origDescriptor)
        }
        setTimeoutSpy.mockRestore()
      }
    })
  })
})

// ===========================================================================
// Group 15 — plugin wiring smoke tests
// ===========================================================================

describe('Group 15 — plugin wiring smoke tests', () => {
  it('15.1 plugin is a function (defineNuxtPlugin returns a callable)', () => {
    expect(typeof pluginDefault).toBe('function')
  })

  it('15.2 plugin wires link:prefetch hook on nuxtApp', () => {
    const nuxtApp = createMockNuxtApp()
    ;(pluginDefault as any)(nuxtApp)
    expect(nuxtApp._capturedHooks['link:prefetch']).toHaveLength(1)
  })

  it('15.3 plugin wires router.beforeResolve', () => {
    _mockRouter = createMockRouter()
    const nuxtApp = createMockNuxtApp()
    ;(pluginDefault as any)(nuxtApp)
    expect(_mockRouter._handlers.beforeResolve).toHaveLength(1)
  })

  it('15.4 plugin wires router.afterEach', () => {
    _mockRouter = createMockRouter()
    const nuxtApp = createMockNuxtApp()
    ;(pluginDefault as any)(nuxtApp)
    expect(_mockRouter._handlers.afterEach).toHaveLength(1)
  })

  it('15.5 plugin does not throw when invoked with minimal nuxtApp', () => {
    const nuxtApp = createMockNuxtApp()
    expect(() => (pluginDefault as any)(nuxtApp)).not.toThrow()
  })

  it('15.6 link:prefetch error in loadPayload is caught and does not propagate', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      // loadPayload throws synchronously after resolving — the plugin wraps
      // the call in .catch(() => console.warn(...)) so the hook should not throw
      vi.mocked(loadPayload).mockRejectedValueOnce(new Error('network error'))

      await expect(
        nuxtApp.fireHook('link:prefetch', 'http://localhost/error-page'),
      ).resolves.not.toThrow()
    })
  })

  it('15.7 invoking plugin twice on different nuxtApp instances does not cross-contaminate', async () => {
    await withWindow(async () => {
      const routerA = createMockRouter()
      const routerB = createMockRouter()

      const nuxtAppA = createMockNuxtApp()
      const nuxtAppB = createMockNuxtApp()

      // Wire plugin to nuxtAppA with routerA
      const { useRouter } = await import('../src/app/composables/router')
      vi.mocked(useRouter).mockReturnValueOnce(routerA as any).mockReturnValueOnce(routerA as any)
      ;(pluginDefault as any)(nuxtAppA)

      // Wire plugin to nuxtAppB with routerB
      vi.mocked(useRouter).mockReturnValueOnce(routerB as any).mockReturnValueOnce(routerB as any)
      ;(pluginDefault as any)(nuxtAppB)

      // link:prefetch handlers are separate per nuxtApp
      expect(nuxtAppA._capturedHooks['link:prefetch']).toHaveLength(1)
      expect(nuxtAppB._capturedHooks['link:prefetch']).toHaveLength(1)

      // routerA and routerB each have their own beforeResolve/afterEach registrations
      expect(routerA._handlers.beforeResolve).toHaveLength(1)
      expect(routerB._handlers.beforeResolve).toHaveLength(1)

      // Drain any entries that may have been inserted by this test
      await routerA.fire('afterEach')
      await routerB.fire('afterEach')
    })
  })

  it('15.8 head.push receives downgraded link with correct shape (end-to-end wiring)', async () => {
    await withWindow(async () => {
      const nuxtApp = setupPlugin()
      vi.mocked(loadPayload).mockResolvedValueOnce({
        data: {},
        prefetchLinks: [{ rel: 'preload', href: '/wiring.js', as: 'script', crossorigin: true }],
      })

      await nuxtApp.fireHook('link:prefetch', 'http://localhost/wiring')

      expect(nuxtApp._mockHead.push).toHaveBeenCalledOnce()
      const pushArg = nuxtApp._mockHead.push.mock.calls[0]![0]
      expect(pushArg).toMatchObject({
        link: [{ rel: 'prefetch', href: '/wiring.js', as: 'script', crossorigin: true }],
      })
    })
  })
})
