import path from 'path'

export default {
  generate: {
    routes: ['/']
  },
  router: {
    index: '~/routes.js'
  },
  modulesDir: path.join(__dirname, '..', '..', '..', 'node_modules')
}
