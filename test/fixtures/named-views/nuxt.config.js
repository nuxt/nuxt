export default {
  router: {
    extendRoutes(routes, resolve) {
      const indexIndex = routes.findIndex(route => route.name === 'index')
      let index = routes[indexIndex].children.findIndex(route => route.name === 'index-child-id')
      routes[indexIndex].children[index] = {
        ...routes[indexIndex].children[index],
        components: {
          default: routes[indexIndex].children[index].component,
          left: resolve(__dirname, 'components/childLeft.vue')
        },
        chunkNames: {
          left: 'components/childLeft'
        }
      }

      index = routes
        .filter(route => route.name === 'main' || route.name === 'another')
        .forEach((route, index) => {
          routes[index] = {
            ...route,
            components: {
              default: route.component,
              top: resolve(__dirname, 'components/mainTop.vue')
            },
            chunkNames: {
              top: 'components/mainTop'
            }
          }
        })
    }
  }
}
