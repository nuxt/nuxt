// https://github.com/vitejs/vite/blob/main/packages/create-vite/template-vue-ts/src/env.d.ts
declare module '*.vue' {
  import { DefineComponent } from '@vue/runtime-core'
  const component: DefineComponent<{}, {}, any>
  export default component
}
