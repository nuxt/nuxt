<%= nuxt.options.css.map(i => `import '${i.src || i}';`).join('') %>
