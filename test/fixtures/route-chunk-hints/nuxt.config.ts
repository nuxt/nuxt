import { withMatrix } from '../../matrix.ts'

export default withMatrix({
  experimental: {
    routeChunkHints: true,
  },
  hooks: {
    // Nuxt prefetches lazily imported chunks, layouts among them, once the app is ready. With
    // that left on, a layout would be fetched whether or not the hints fetch it.
    'build:manifest' (manifest) {
      for (const chunk of Object.values(manifest)) {
        chunk.prefetch = false
      }
    },
  },
})
