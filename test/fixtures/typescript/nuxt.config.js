import consola from 'consola'

export default {
  build: {
    useForkTsChecker: {
      logger: consola
    }
  },
  plugins: [
    '~/plugins/plugin'
  ],
  serverMiddleware: [
    '~/server-middleware/test.ts'
  ]
}
