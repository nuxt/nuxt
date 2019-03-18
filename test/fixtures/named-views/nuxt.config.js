export default {
  router: {
    extendRoutes(routes, resolve) {
      const indexChildRoute = routes.find(route => route.name === 'index')
        .children.find(route => route.name === 'index-child-id')

      Object.assign(indexChildRoute, {
        components: {
          default: indexChildRoute.component,
          left: resolve(__dirname, 'components/childLeft.vue')
        },
        chunkNames: {
          left: 'components/childLeft'
        }
      })

      routes
        .filter(route => route.name === 'main' || route.name === 'another')
        .forEach((route) => {
          Object.assign(route, {
            components: {
              default: route.component,
              top: resolve(__dirname, 'components/mainTop.vue')
            },
            chunkNames: {
              top: 'components/mainTop'
            }
          })
        })
    }
  }
}
