<%= isTest ? '/* eslint-disable quotes, semi, indent, comma-spacing, key-spacing, object-curly-spacing, space-before-function-paren  */' : '' %>
const head = <%= serializeFunction(head) %>
<%= isTest ? '/* eslint-enable quotes, semi, indent, comma-spacing, key-spacing, object-curly-spacing, space-before-function-paren */' : '' %>

<%
// Inject link with alias
if (head.link) {
  head.link.forEach((link, index) => {
    if(startsWithRootAlias(link.href) || startsWithSrcAlias(link.href)) {
%>
head.link[<%= index %>].href = require('<%= relativeToBuild(resolvePath(link.href)) %>')
<%
    }
  })
}

// Inject script with alias
if (head.script) {
  head.script.forEach((script, index) => {
    if(startsWithRootAlias(script.src) || startsWithSrcAlias(script.src)) {
%>
head.script[<%= index %>].src = require('<%= relativeToBuild(resolvePath(script.src)) %>')
<%
    }
  })
}
%>

export default head
