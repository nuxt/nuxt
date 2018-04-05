import Vue from 'vue'
import Router from 'vue-router'

<% function recursiveRoutes(routes, tab, components) {
  let res = ''
  routes.forEach((route, i) => {
    route._name = '_' + hash(route.component)
    components.push({ _name: route._name, component: route.component, name: route.name, chunkName: route.chunkName })
    res += tab + '{\n'
    res += tab + '\tpath: ' + JSON.stringify(route.path)
    res += (route.component) ? ',\n\t' + tab + 'component: ' + (splitChunks.pages ? route._name : `() => ${route._name}.default || ${route._name}`) : ''
    // Route-to-props translation
    // Example: /posts/_postId/comments/_commentId.vue
    //
    // If lazy-loading: (look up the cache in routeToPropsCache)
    //    props: routeToPropsCache.routeToPropsFn(_012abc, ['postId', 'commentId'])
    //
    // If fat bundle: (use routeToProps if available, else generate one)
    //    props: routeToPropsCache.componentRouteToProps(_012abc.default || _012abc) ||
    //      (route) => routeToPropsCache.routeFromPropsFromPath(route, ['postId', 'commentId'])
    res += ',\n\t' + tab + 'props: ' + (splitChunks.pages
        ? `routeToPropsCache.routeToPropsFn(${JSON.stringify(route._name)}, ${JSON.stringify(route.propsFromPath || [])})`
        : `routeToPropsCache.componentRouteToProps(${route._name}.default || ${route._name}) ||
 (route) => routeToPropsCache.routeFromPropsFromPath(route, ${JSON.stringify(route.propsFromPath || [])})`) 
    res += (route.redirect) ? ',\n\t' + tab + 'redirect: ' + JSON.stringify(route.redirect) : ''
    res += (route.name) ? ',\n\t' + tab + 'name: ' + JSON.stringify(route.name) : ''
    res += (route.children) ? ',\n\t' + tab + 'children: [\n' + recursiveRoutes(routes[i].children, tab + '\t\t', components) + '\n\t' + tab + ']' : ''
    res += '\n' + tab + '}' + (i + 1 === routes.length ? '' : ',\n')
  })
  return res
}
const _components = []
const _routes = recursiveRoutes(router.routes, '\t\t', _components)
%><%= uniqBy(_components, '_name').map((route) => {
  if (!route.component) return ''
  const path = relativeToBuild(route.component)
  const chunkName = wChunk(route.chunkName)
  const name = route._name

  if (splitChunks.pages) {
    return `const ${name} = () => import('${path}' /* webpackChunkName: "${chunkName}" */).then(m => {
      routeToPropsCache.newComponentLoaded(${JSON.stringify(name)}, m.default || m)
      return m.default || m
    })`
  } else {
    return `import ${name} from '${path}'`
  }
}).join('\n')%>

Vue.use(Router)

/**
 * If we are using lazy loading of components, then component definitions are
 * not immediately available, so we cannot determine how to translate
 * route to props.
 * 
 * Once component is loaded, the method `newComponentLoaded()` is called.
 * This updates the cache of routeToProps functions.
 * Just before the component is routed to, the method `routeToPropsFn`
 * is used to access the saved value in the cache.
 */
const routeToPropsCache = {
  fnCache: {},
  /**
   * Given a component definition, produce a route definition:
   * 
   * If <comp>.routeToProps exists, use that function.
   * Else extract the prop names from the path, i.e.
   *   /appointments/_year/_month/_day.vue -->
   *    { year: route.params.year, month: route.params.month, day: route.params.day }
   */
  routeFromPropsFromPath: (route, propsFromPath) => {
    return propsFromPath.reduce(
      (allProps, prop) => {
        allProps[prop] = route.params[prop]
        return allProps
      },
      {}
    )
  },
  componentRouteToProps: (component) => {
    // If no props are defined, then disable translation of
    // route to props. For commonly used props (e.g. `id`) that
    // also has semantics in HTML, this prevents the generation
    // of spurious attributes.
    // Note: this does not work if props are defined on mixins.
    // If you define props on mixins, and you need translation,
    // set `props: []`
    return component.props ? component.routeToProps : (route) => {}
  },
  newComponentLoaded(name, component) {
    this.fnCache[name] = this.componentRouteToProps(component)
  },
  routeToPropsFn(name, propsFromPath) {
    return (route) => this.fnCache[name]
      ? this.fnCache[name](route)
      : this.routeFromPropsFromPath(route, propsFromPath)
  }
}

<% if (router.scrollBehavior) { %>
const scrollBehavior = <%= serialize(router.scrollBehavior).replace('scrollBehavior(', 'function(').replace('function function', 'function') %>
<% } else { %>
if (process.client) {
  window.history.scrollRestoration = 'manual'
}
const scrollBehavior = function (to, from, savedPosition) {
  // if the returned position is falsy or an empty object,
  // will retain current scroll position.
  let position = false

  // if no children detected
  if (to.matched.length < 2) {
    // scroll to the top of the page
    position = { x: 0, y: 0 }
  } else if (to.matched.some((r) => r.components.default.options.scrollToTop)) {
    // if one of the children has scrollToTop option set to true
    position = { x: 0, y: 0 }
  }

  // savedPosition is only available for popstate navigations (back button)
  if (savedPosition) {
    position = savedPosition
  }

  return new Promise(resolve => {
    // wait for the out transition to complete (if necessary)
    window.$nuxt.$once('triggerScroll', () => {
      // coords will be used if no selector is provided,
      // or if the selector didn't match any element.
      if (to.hash) {
        let hash = to.hash
        // CSS.escape() is not supported with IE and Edge.
        if (typeof window.CSS !== 'undefined' && typeof window.CSS.escape !== 'undefined') {
          hash = '#' + window.CSS.escape(hash.substr(1))
        }
        try {
          if (document.querySelector(hash)) {
            // scroll to anchor by returning the selector
            position = { selector: hash }
          }
        } catch (e) {
          console.warn('Failed to save scroll position. Please add CSS.escape() polyfill (https://github.com/mathiasbynens/CSS.escape).')
        }
      }
      resolve(position)
    })
  })
}
<% } %>

export function createRouter () {
  return new Router({
    mode: '<%= router.mode %>',
    base: '<%= router.base %>',
    linkActiveClass: '<%= router.linkActiveClass %>',
    linkExactActiveClass: '<%= router.linkExactActiveClass %>',
    scrollBehavior,
    routes: [
<%= _routes %>
    ],
    <% if (router.parseQuery) { %>parseQuery: <%= serialize(router.parseQuery).replace('parseQuery(', 'function(') %>,<% } %>
    <% if (router.stringifyQuery) { %>stringifyQuery: <%= serialize(router.stringifyQuery).replace('stringifyQuery(', 'function(') %>,<% } %>
    fallback: <%= router.fallback %>
  })
}
