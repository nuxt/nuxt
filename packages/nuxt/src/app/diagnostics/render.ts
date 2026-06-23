import { defineDiagnostics } from 'nostics'
import { docsBase, reporters } from './_shared.ts'

/** E4xxx — Layout / component / island rendering runtime diagnostics. */
export const renderDiagnostics = /* #__PURE__ */ defineDiagnostics({
  docsBase,
  reporters,
  codes: {
    NUXT_E4001: {
      why: (p: { layout: string, available: string }) => `Invalid layout \`${p.layout}\` selected. Available layouts: ${p.available}.`,
      fix: (p: { layout: string }) => `Create a \`layouts/${p.layout}.vue\` file, or use one of the available layouts.`,
    },
    NUXT_E4002: {
      why: (p: { name: string }) => `\`${p.name}\` layout does not have a single root node and will cause errors when navigating between routes.`,
      fix: 'Wrap the layout\'s template in a single root element (e.g., a `<div>`).',
      docs: false,
    },
    NUXT_E4003: {
      why: '`<NuxtLayout>` needs to be passed a single root node in its default slot.',
      fix: 'Wrap the content inside `<NuxtLayout>` in a single root element.',
      docs: false,
    },
    NUXT_E4004: {
      why: (p: { filename: string }) => `\`${p.filename}\` does not have a single root node and will cause errors when navigating between routes.`,
      fix: 'Wrap the page component\'s template in a single root element (e.g., a `<div>`).',
      docs: false,
    },
    NUXT_E4005: {
      why: (p: { name: string }) => `Server component "${p.name}" must have a single root element. (HTML comments are considered elements as well.)`,
      fix: 'Wrap the server component\'s template in a single root element (e.g., a `<div>`).',
      docs: false,
    },
    NUXT_E4006: {
      why: 'SSR rendering failed inside `<NuxtClientFallback>`, falling back to client-side rendering.',
      fix: 'Fix the SSR error in the wrapped component. The client-side fallback will be used until then.',
      docs: false,
    },
    NUXT_E4007: {
      why: 'Your project has layouts but the `<NuxtLayout />` component has not been used.',
      fix: 'Add `<NuxtLayout>` to your `app.vue`, or set `pages: false` in `nuxt.config` if you don\'t need layouts.',
    },
    NUXT_E4008: {
      why: (p: { path: string }) => `Cannot access path outside of project root directory: \`${p.path}\`.`,
      fix: 'Use a path within the project root directory for the test component wrapper.',
      docs: false,
    },
    NUXT_E4009: {
      why: 'You can\'t nest one `<a>` inside another `<a>`. This will cause a hydration error on client-side.',
      fix: 'Pass the `custom` prop to take full control of the markup.',
    },
    NUXT_E4010: {
      why: (p: { componentName: string, main: string, sub: string }) => `[${p.componentName}] \`${p.main}\` and \`${p.sub}\` cannot be used together. \`${p.sub}\` will be ignored.`,
      fix: (p: { main: string, sub: string }) => `Remove the \`${p.sub}\` prop and use only \`${p.main}\`.`,
      docs: false,
    },
    NUXT_E4011: {
      why: 'Your project has pages but the `<NuxtPage />` component has not been used. You might be using the `<RouterView />` component instead, which will not work correctly in Nuxt.',
      fix: 'You can set `pages: false` in `nuxt.config` if you do not wish to use the Nuxt `vue-router` integration.',
    },
    NUXT_E4012: {
      why: (p: { name: string, status: number, detail: string }) => `Failed to parse island response for \`${p.name}\` (HTTP ${p.status}): ${p.detail}`,
      fix: 'Check that the server component endpoint is returning valid HTML. The server may have returned an error page.',
      docs: false,
    },
    NUXT_E4013: {
      why: (p: { source: number }) => `The v-for range expects an integer value but got ${p.source}.`,
      fix: 'Use `Math.floor()` or `Math.round()` to convert the value to an integer.',
      docs: false,
    },
    NUXT_E4014: {
      why: (p: { dir: string }) => `No pages found. \`<NuxtPage>\` requires at least one page component in the \`${p.dir}/\` directory.`,
      fix: (p: { dir: string }) => `Create an \`index.vue\` file inside the \`${p.dir}/\` directory.`,
    },
  },
})
