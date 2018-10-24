import Vue from 'vue'
import Router from 'vue-router'
import { interopDefault } from './utils'

<% function recursiveRoutes(routes, tab, components, indentCount) {
  let res = ''
  const baseIndent = tab.repeat(indentCount)
  const firstIndent = '\n' + tab.repeat(indentCount + 1)
  const nextIndent = ',' + firstIndent
  routes.forEach((route, i) => {
    route._name = '_' + hash(route.component)
    components.push({ _name: route._name, component: route.component, name: route.name, chunkName: route.chunkName })
    // @see: https://router.vuejs.org/api/#router-construction-options
    res += '{'
    res += firstIndent + 'path: ' + JSON.stringify(route.path)
    res += (route.component) ? nextIndent + 'component: ' + (splitChunks.pages ? route._name : `() => ${route._name}.default || ${route._name}`) : ''
    res += (route.redirect) ? nextIndent + 'redirect: ' + JSON.stringify(route.redirect) : ''
    res += (route.meta) ? nextIndent + 'meta: ' + JSON.stringify(route.meta) : ''
    res += (typeof route.props !== 'undefined') ? nextIndent + 'props: ' + (typeof route.props === 'function' ? serialize(route.props) : JSON.stringify(route.props)) : ''
    res += (typeof route.caseSensitive !== 'undefined') ? nextIndent + 'caseSensitive: ' + JSON.stringify(route.caseSensitive) : ''
    res += (route.alias) ? nextIndent + 'alias: ' + JSON.stringify(route.alias) : ''
    res += (route.pathToRegexpOptions) ? nextIndent + 'pathToRegexpOptions: ' + JSON.stringify(route.pathToRegexpOptions) : ''
    res += (route.name) ? nextIndent + 'name: ' + JSON.stringify(route.name) : ''
    if (route.beforeEnter) {
      if(isTest) { res += ',\n/* eslint-disable indent, semi */' }
      res += (isTest ? firstIndent : nextIndent) + 'beforeEnter: ' + serialize(route.beforeEnter)
      if(isTest) { res += firstIndent + '/* eslint-enable indent, semi */' }
    }
    res += (route.children) ? nextIndent + 'children: [' + recursiveRoutes(routes[i].children, tab, components, indentCount + 1) + ']' : ''
    res += '\n' + baseIndent + '}' + (i + 1 === routes.length ? '' : ', ')
  })
  return res
}
const _components = []
const _routes = recursiveRoutes(router.routes, '  ', _components, 2)
%><%= uniqBy(_components, '_name').map((route) => {
  if (!route.component) return ''
  const path = relativeToBuild(route.component)
  const chunkName = wChunk(route.chunkName)
  const name = route._name

  if (splitChunks.pages) {
    return `const ${name} = () => interopDefault(import('${path}' /* webpackChunkName: "${chunkName}" */))`
  } else {
    return `import ${name} from '${path}'`
  }
}).join('\n')%>

Vue.use(Router)

<% if (router.scrollBehavior) { %>
const scrollBehavior = <%= serialize(router.scrollBehavior).replace(/scrollBehavior\s*\(/, 'function(').replace('function function', 'function') %>
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
  } else if (to.matched.some(r => r.components.default.options.scrollToTop)) {
    // if one of the children has scrollToTop option set to true
    position = { x: 0, y: 0 }
  }

  // savedPosition is only available for popstate navigations (back button)
  if (savedPosition) {
    position = savedPosition
  }

  return new Promise((resolve) => {
    // wait for the out transition to complete (if necessary)
    window.<%= globals.nuxt %>.$once('triggerScroll', () => {
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

export function createRouter() {
  return new Router({
    mode: '<%= router.mode %>',
    base: '<%= router.base %>',
    linkActiveClass: '<%= router.linkActiveClass %>',
    linkExactActiveClass: '<%= router.linkExactActiveClass %>',
    scrollBehavior,
    <%= isTest ? '/* eslint-disable quotes */' : '' %>
    routes: [<%= _routes %>],
    <%= isTest ? '/* eslint-enable quotes */' : '' %>
    <% if (router.parseQuery) { %>parseQuery: <%= serialize(router.parseQuery).replace('parseQuery(', 'function(') %>,<% } %>
    <% if (router.stringifyQuery) { %>stringifyQuery: <%= serialize(router.stringifyQuery).replace('stringifyQuery(', 'function(') %>,<% } %>
    fallback: <%= router.fallback %>
  })
}
