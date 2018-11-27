export default {
  router: {
    extendRoutes(routes, resolve) {
      const index = routes[0].children.findIndex(route => route.name === 'index-child-id')
      const child = routes[0].children[index]
      child.components = {
        default: child.component,
        left: resolve(__dirname, 'components/childLeft.vue')
      }
      child.chunkNames = {
        left: 'components/childLeft'
      }
      routes[0].children[index] = child
    }
  }
}
