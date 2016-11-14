'use strict'

import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

<% router.routes.forEach(function (route) { %>
const <%= route._name %> = process.BROWSER ? () => System.import('<%= route._component %>') : require('<%= route._component %>')
<% }) %>

const scrollBehavior = (to, from, savedPosition) => {
  if (savedPosition) {
    // savedPosition is only available for popstate navigations.
    return savedPosition
  } else {
    // Scroll to the top by default
    let position = { x: 0, y: 0 }
    // if link has anchor,  scroll to anchor by returning the selector
    if (to.hash) {
      position = { selector: to.hash }
    }
    return position
  }
}

export default new Router({
  mode: 'history',
  base: '<%= router.base %>',
  linkActiveClass: '<%= router.linkActiveClass %>',
  scrollBehavior,
  routes: [
    <% router.routes.forEach((route, i) => { %>
    {
      path: '<%= route.path %>',
      component: <%= route._name %><% if (route.name) { %>,
      name: '<%= route.name %>'<% } %><% if (route.meta) { %>,
      meta: <%= JSON.stringify(route.meta) %><% } %>
    }<%= (i + 1 === router.routes.length ? '' : ',') %>
    <% }) %>
  ]
})
