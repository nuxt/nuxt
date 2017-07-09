import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

<%
function recursiveRoutes(routes, tab, components) {
  let res = ''
  routes.forEach((route, i) => {
    route._name = '_' + hash(route.component)
    components.push({ _name: route._name, component: route.component, name: route.name })
    res += tab + '{\n'
    res += tab + '\tpath: ' + JSON.stringify(route.path) + ',\n'
    res += tab + '\tcomponent: ' + route._name
    res += (route.name) ? ',\n\t' + tab + 'name: ' + JSON.stringify(route.name) : ''
    res += (route.children) ? ',\n\t' + tab + 'children: [\n' + recursiveRoutes(routes[i].children, tab + '\t\t', components) + '\n\t' + tab + ']' : ''
    res += '\n' + tab + '}' + (i + 1 === routes.length ? '' : ',\n')
  })
  return res
}
const _components = []
const _routes = recursiveRoutes(router.routes, '\t\t', _components)
uniqBy(_components, '_name').forEach((route) => { %>const <%= route._name %> = () => import('<%= relativeToBuild(route.component) %>' /* webpackChunkName: "pages/<%= route.name %>" */).then(m => m.default || m)
<% }) %>

<% if (router.scrollBehavior) { %>
const scrollBehavior = <%= serialize(router.scrollBehavior).replace('scrollBehavior(', 'function(') %>
<% } else { %>
const scrollBehavior = (to, from, savedPosition) => {
  // SavedPosition is only available for popstate navigations.
  if (savedPosition) {
    return savedPosition
  } else {
    let position = {}
    // If no children detected
    if (to.matched.length < 2) {
      // Scroll to the top of the page
      position = { x: 0, y: 0 }
    }
    else if (to.matched.some((r) => r.components.default.options.scrollToTop)) {
      // If one of the children has scrollToTop option set to true
      position = { x: 0, y: 0 }
    }
    // If link has anchor, scroll to anchor by returning the selector
    if (to.hash) {
      position = { selector: to.hash }
    }
    return position
  }
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
    fallback: <%= router.fallback %>
  })
}
