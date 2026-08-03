import { defineDiagnostics, defineProdDiagnostics } from 'nostics'
import { docsBase, prodReporters, reporters } from './_shared'

/**
 * E2xxx
 * Navigation / routing / middleware runtime diagnostics.
 */
export const navigationDiagnostics = !import.meta.dev
  ? /* #__PURE__ */ defineProdDiagnostics({ docsBase, reporters: prodReporters })
  : /* #__PURE__ */ defineDiagnostics({
      docsBase,
      reporters,
      codes: {
        NUXT_E2001: {
          why: (p: { toPath: string }) => `Navigating to external URL \`${p.toPath}\` is not allowed by default.`,
          fix: (p: { toPath: string }) => `Use \`navigateTo('${p.toPath}', { external: true })\` to allow external navigation.`,
        },
        NUXT_E2002: {
          why: (p: { toPath: string, protocol: string }) => `Cannot navigate to URL \`${p.toPath}\` with \`${p.protocol}\` protocol.`,
          fix: 'Script protocols (e.g. `javascript:`) are blocked for security. Use a valid `http:` or `https:` URL.',
        },
        NUXT_E2003: {
          why: '`abortNavigation()` was called outside a route middleware handler.',
          fix: 'Move this call inside a route middleware defined with `defineNuxtRouteMiddleware()` or `addRouteMiddleware()`.',
        },
        NUXT_E2004: {
          why: (p: { entry: string }) => `Unknown route middleware: '${p.entry}'.`,
          fix: (p: { entry: string, validMiddleware?: string[] }) => `Create a \`middleware/${p.entry}.ts\` file, or check the middleware name for typos.${p.validMiddleware?.length ? ` Valid middleware: ${p.validMiddleware.map(mw => `'${mw}'`).join(', ')}.` : ''}`,
        },
        NUXT_E2005: {
          why: (p: { middleware?: string, trace: string }) => `\`useRoute\` was called within middleware${p.middleware ? ` (\`${p.middleware}\`)` : ''}. This may lead to misleading results.\n${p.trace}`,
          fix: 'Use the `to` and `from` arguments passed to the middleware function instead of `useRoute()`.',
        },
        NUXT_E2006: {
          why: 'No route middleware passed to `addRouteMiddleware`.',
          fix: 'Pass a middleware function as the second argument: `addRouteMiddleware(\'name\', (to, from) => { ... })`.',
          docs: false,
        },
        NUXT_E2007: {
          why: '`setPageLayout` was called to change the layout on the server within a component, which will cause hydration errors.',
          fix: 'Call `setPageLayout` in a route middleware or plugin instead of inside a component\'s `setup()`.',
        },
        NUXT_E2008: {
          why: '`setPageLayout` was called to change the layout during hydration, which will cause hydration errors.',
          fix: 'Set the layout in `definePageMeta` or in a route middleware before hydration occurs.',
          docs: false,
        },
        NUXT_E2009: {
          why: 'A middleware error was thrown but no error handlers are registered to handle it.',
          fix: 'Register an error handler with `router.onError()` or add error handling within your middleware.',
          docs: false,
        },
        NUXT_E2010: {
          why: (p: { path: string }) => `\`reloadNuxtApp\` cannot navigate to \`${p.path}\` because it is on a different host.`,
          fix: 'Pass a path on the same host, or use `navigateTo(path, { external: true })` for cross-origin navigation.',
          docs: false,
        },
        NUXT_E2011: {
          why: (p: { componentName: string }) => `\`<${p.componentName}>\` refused to navigate to a URL with a script-capable protocol.`,
          fix: 'Script protocols (e.g. `javascript:`) are blocked for security. Use a valid `http:` or `https:` URL.',
          docs: false,
        },
      },
    })
