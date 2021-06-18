declare module 'vue' {
  export interface GlobalComponents {
<%= components.map(c => {
  return `    ${c.pascalName}: typeof import('${c.filePath}')['${c.export}']`
}).join(',\n') %>
  }
}
