<% if (router.extendRoutes) { %>
  <%= isTest ? '/* eslint-disable quotes, semi, indent, comma-spacing, key-spacing, object-curly-spacing, space-before-function-paren  */' : '' %>
  export default <%= serializeFunction(router.extendRoutes) %>
  <%= isTest ? '/* eslint-enable quotes, semi, indent, comma-spacing, key-spacing, object-curly-spacing, space-before-function-paren  */' : '' %>
  <% } else { %>
  export default function() {
    console.log('Empty extend routes function')
  }
  <% } %>
  