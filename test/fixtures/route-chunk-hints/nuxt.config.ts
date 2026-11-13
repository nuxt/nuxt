import { withMatrix } from '../../matrix.ts'

export default withMatrix({
  experimental: {
    routeChunkHints: true,
  },
  hooks: {
    // a second route to the index page, so that the history can hold two entries that need no
    // other chunk
    'pages:extend' (pages) {
      const index = pages.find(page => page.path === '/')!
      pages.push({ ...index, name: 'again', path: '/again' })
    },
    // Nuxt prefetches lazily imported chunks, layouts among them, once the app is ready. With
    // that left on, a layout would be fetched whether or not the hints fetch it.
    'build:manifest' (manifest) {
      for (const chunk of Object.values(manifest)) {
        chunk.prefetch = false
      }
    },
  },
})
