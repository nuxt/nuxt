import { defineUntypedSchema } from 'untyped'

export default defineUntypedSchema({
  /**
   * Configuration for Nuxt's TypeScript integration.
   *
   */
  typescript: {
    /**
     * TypeScript comes with certain checks to give you more safety and analysis of your program.
     * Once you’ve converted your codebase to TypeScript, you can start enabling these checks for greater safety.
     * [Read More](https://www.typescriptlang.org/docs/handbook/migrating-from-javascript.html#getting-stricter-checks)
     */
    strict: false,

    /**
     * Include parent workspace in the Nuxt project. Mostly useful for themes and module authors.
     */
    includeWorkspace: false,

    /**
     * Enable build-time type checking.
     *
     * If set to true, this will type check in development. You can restrict this to build-time type checking by setting it to `build`.
     *
     * @type {boolean | 'build'}
     */
    typeCheck: false,

    /**
     * You can extend generated `.nuxt/tsconfig.json` using this option.
     * @type {typeof import('pkg-types')['readPackageJSON']}
     */
    tsConfig: {},

    /**
     * Generate a `*.vue` shim.
     *
     * We recommend instead either enabling [**Take Over Mode**](https://vuejs.org/guide/typescript/overview.html#volar-takeover-mode) or adding
     * TypeScript Vue Plugin (Volar)** 👉 [[Download](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin)].
     */
    shim: true
  }
})
