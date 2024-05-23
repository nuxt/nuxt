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
    strict: true,

    /**
     * Which builder types to include for your project.
     *
     * By default Nuxt infers this based on your `builder` option (defaulting to 'vite') but you can either turn off
     * builder environment types (with `false`) to handle this fully yourself, or opt for a 'shared' option.
     *
     * The 'shared' option is advised for module authors, who will want to support multiple possible builders.
     * @type {'vite' | 'webpack' | 'shared' | false | undefined}
     */
    builder: {
      $resolve: val => val ?? null,
    },

    /**
     * Modules to generate deep aliases for within `compilerOptions.paths`. This does not yet support subpaths.
     * It may be necessary when using Nuxt within a pnpm monorepo with `shamefully-hoist=false`.
     */
    hoist: {
      $resolve: (val) => {
        const defaults = [
          // Nitro auto-imported/augmented dependencies
          'nitropack',
          'defu',
          'h3',
          'consola',
          'ofetch',
          // Key nuxt dependencies
          '@unhead/vue',
          '@nuxt/devtools',
          'vue',
          '@vue/runtime-core',
          '@vue/compiler-sfc',
          '@vue/runtime-dom',
          'vue-router',
          '@nuxt/schema',
          'nuxt',
        ]
        return val === false ? [] : (Array.isArray(val) ? val.concat(defaults) : defaults)
      },
    },

    /**
     * Include parent workspace in the Nuxt project. Mostly useful for themes and module authors.
     */
    includeWorkspace: false,

    /**
     * Enable build-time type checking.
     *
     * If set to true, this will type check in development. You can restrict this to build-time type checking by setting it to `build`.
     * Requires to install `typescript` and `vue-tsc` as dev dependencies.
     * @see https://nuxt.com/docs/guide/concepts/typescript
     * @type {boolean | 'build'}
     */
    typeCheck: false,

    /**
     * You can extend generated `.nuxt/tsconfig.json` using this option.
     * @type {0 extends 1 & VueCompilerOptions ? typeof import('pkg-types')['TSConfig'] : typeof import('pkg-types')['TSConfig'] & { vueCompilerOptions?: typeof import('@vue/language-core')['VueCompilerOptions']}}
     */
    tsConfig: {},

    /**
     * Generate a `*.vue` shim.
     *
     * We recommend instead letting the [official Vue extension](https://marketplace.visualstudio.com/items?itemName=Vue.volar)
     * generate accurate types for your components.
     *
     * Note that you may wish to set this to `true` if you are using other libraries, such as ESLint,
     * that are unable to understand the type of `.vue` files.
     */
    shim: false,
  },
})
