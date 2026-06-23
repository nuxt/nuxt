import { defineDiagnostics } from 'nostics'
import { docsBase, reporters } from './_shared.ts'

/** B8xxx — Kit API diagnostics. */
export const kitDiagnostics = /* #__PURE__ */ defineDiagnostics({
  docsBase,
  reporters,
  codes: {
    NUXT_B8001: {
      why: 'The active Nuxt instance is unavailable in the current context.',
      fix: 'Call this within a Nuxt module `setup()` function, or inside a `nuxt.hook()` callback.',
    },
    NUXT_B8002: {
      why: 'The `base` argument to `createResolver(base)` is missing.',
      fix: 'Pass `import.meta.url` or a directory path as the `base` argument to `createResolver()`.',
      docs: false,
    },
    NUXT_B8003: {
      why: 'Nitro is not initialized yet — `useNitro()` was called before the `ready` hook ran.',
      fix: 'Move the `useNitro()` call inside a hook that runs after initialization, such as `nuxt.hook(\'ready\', () => { ... })`.',
    },
    NUXT_B8004: {
      why: (p: { issues: string }) => `Nuxt compatibility issues were found:\n${p.issues}`,
      fix: 'Update the module to support the current Nuxt version, or check if a newer version of the module is available.',
    },
    NUXT_B8005: {
      why: 'The Nuxt version cannot be determined — no current instance was passed.',
      fix: 'Pass a valid Nuxt instance to `getNuxtVersion()`, or ensure `useNuxt()` is available in the current context.',
      docs: false,
    },
    NUXT_B8006: {
      why: (p: { cwd: string }) => `No Nuxt version could be found from \`${p.cwd}\`.`,
      fix: 'Run `npm install nuxt` in your project directory to install Nuxt.',
    },
    NUXT_B8007: {
      why: (p: { template: string }) => `The type template filename \`${p.template}\` is invalid.`,
      fix: 'Rename the template filename to end with `.d.ts`.',
      docs: false,
    },
    NUXT_B8008: {
      why: (p: { template: string }) => `The template value is invalid: ${p.template}.`,
      fix: 'Pass a valid template object or a string path to `addTemplate()`.',
      docs: false,
    },
    NUXT_B8009: {
      why: (p: { template: string }) => `The template was not found at \`${p.template}\`.`,
      fix: 'Check that the `src` path exists and is an absolute path or resolvable from the module directory.',
      docs: false,
    },
    NUXT_B8010: {
      why: (p: { template: string }) => `The template \`${p.template}\` provides neither \`getContents\` nor \`src\`.`,
      fix: 'Add a `getContents` function or a `src` path to the template object.',
      docs: false,
    },
    NUXT_B8011: {
      why: (p: { template: string }) => `The template is missing a \`filename\`: ${p.template}.`,
      fix: 'Add a `filename` property to the template object, or provide a `src` path so the filename can be derived from it.',
      docs: false,
    },
    NUXT_B8012: {
      why: (p: { name: string }) => `\`${p.name}\` was used outside of a Nuxt context.`,
      fix: 'Register this module in the `modules` array of `nuxt.config` rather than calling it directly.',
      docs: false,
    },
    NUXT_B8013: {
      why: (p: { message: string }) => p.message,
      fix: 'Update the module to a version that supports the current Nuxt version, or set `experimental.enforceModuleCompatibility` to `true` to make this a fatal error.',
    },
    NUXT_B8014: {
      why: (p: { name: string, time: number }) => `Module \`${p.name}\` was slow to set up, taking \`${p.time}ms\`.`,
      fix: 'Defer expensive operations to a later hook (e.g. `build:before`) to reduce startup time.',
    },
    NUXT_B8015: {
      why: (p: { received: string }) => `A Nuxt module must be a function or a string to import. Received: \`${p.received}\`.`,
      fix: 'Pass a module function or a string package name to the `modules` array in `nuxt.config`.',
      docs: false,
    },
    NUXT_B8016: {
      why: (p: { module: string }) => `The Nuxt module \`${p.module}\` is not a function.`,
      fix: 'Ensure the module has a default export that is a function, using `defineNuxtModule()` to create a valid module.',
      docs: false,
    },
    NUXT_B8017: {
      why: (p: { module: string }) => `The module \`${p.module}\` could not be loaded — it may not be installed.`,
      fix: (p: { module: string }) => `Run \`npm install ${p.module}\` to install it.`,
    },
    NUXT_B8018: {
      why: (p: { module: string, error: string }) => `An error occurred while importing the module \`${p.module}\`: ${p.error}.`,
      fix: 'A sub-dependency of this module is missing. Install it, or check that the module is compatible with the current environment.',
    },
    NUXT_B8019: {
      why: (p: { phase: string, name: string, error: string }) => `An error occurred while executing the ${p.phase} hook for module \`${p.name}\`: ${p.error}.`,
      fix: 'Check the module\'s install/upgrade hook implementation, or report this issue to the module author.',
      docs: false,
    },
  },
})
