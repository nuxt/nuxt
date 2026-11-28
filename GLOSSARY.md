# Glossary

<!-- Format and checks: https://glosslint.onmax.me/guide/glossary -->

The terms the Nuxt docs (`docs/`), the config schema JSDoc (`packages/schema`) and runtime diagnostics use. A proposal: each term lists the variants found in the docs today.

## Server route
What: A handler in `server/api/` or `server/routes/`, or one a module adds with `addServerHandler`, that answers HTTP requests at a path.
How: An API route is a server route under `/api`; "API endpoint" stays for an external API that `$fetch` calls; say "API route" only when the `/api` prefix matters. Server middleware runs before every server route and is not one. The function a server route or server middleware exports is its handler.
Avoid:
- server endpoint: Same thing; the directory page calls it a server route.
- server API route: Use "server route", or "API route".
- API handler: The handler is the function; the route is the file and its path.
Good:
- Throw `createError` from a server route
Bad:
- Throw `createError` from a server endpoint
Links:
- [server/ directory](https://nuxt.com/docs/directory-structure/server#server-routes)

## Server handler
What: A function registered with `defineHandler()` in `server/` or with `addServerHandler()`, which Nuxt runs as a server route or as server middleware.
How: Use it when the text covers both routes and middleware, as Kit's `addServerHandler` does. For a handler at a path, say server route.
Links:
- [Nuxt Kit: Nitro](https://nuxt.com/docs/api/kit/nitro#addserverhandler)

## NuxtApp
What: The per-request runtime app that `useNuxtApp()` returns, holding the Vue app, the payload, hooks and provided helpers.
How: Not the build-time Nuxt instance that modules receive. In prose, "the Nuxt app".
Links:
- [NuxtApp](https://nuxt.com/docs/guide/going-further/nuxt-app)
Case: exact

## Nuxt context
What: Where a composable can reach the current NuxtApp: a plugin, a Nuxt hook, route middleware, or a Vue `setup()` function.
How: Runtime only. For the build-time object, say "the Nuxt instance" (`useNuxt()`); for where Kit can call `useNuxt()`, say "inside a module or a Nuxt hook". For typed templates, say "the app types".
Links:
- [The Nuxt context](https://nuxt.com/docs/guide/going-further/nuxt-app#the-nuxt-context)

## Nuxt instance
What: The build-time `Nuxt` object that `loadNuxt()` creates and `useNuxt()` returns, holding the resolved options, hooks and the module graph.
How: Build time only, in modules and Kit. A composable that runs in the app needs the NuxtApp, not this object.
Links:
- [Nuxt Kit: context](https://nuxt.com/docs/api/kit/context)

## App builder
What: The package that bundles the Vue app: the browser bundle and, with SSR, the server entry. Vite (default), webpack, Rspack and Rsbuild, selected with the `builder` option.
How: "Bundler" is the tool inside it (Vite, Rolldown, webpack). Plain "builder" means the app builder only where the `builder` option is the topic.
Links:
- [Creating an App Builder or Server Builder](https://nuxt.com/docs/guide/going-further/builders)

## Server builder
What: The package that turns the app build into a deployable server. `@nuxt/nitro-server` (Nitro) is the default; `@nuxt/vite-server` is experimental. Selected with `server.builder`.
How: Nitro is one server builder, not "the server engine" of every Nuxt app. Say "Nitro" when the feature only exists on Nitro.
Avoid:
- server engine: Since server builders, Nitro is the default server builder, not the only one.
Links:
- [Creating an App Builder or Server Builder](https://nuxt.com/docs/guide/going-further/builders)

## Route middleware
What: A function that runs before navigation to a route in the Vue app: inline in `definePageMeta`, named in `app/middleware/`, or global with a `.global` suffix.
How: Not server middleware, which runs on the server before server routes.
Avoid:
- Nuxt middleware: The directory page and `defineNuxtRouteMiddleware` call it route middleware.
Good:
- Call it in a plugin or route middleware
Bad:
- Call it in a plugin or Nuxt middleware
Links:
- [middleware/ directory](https://nuxt.com/docs/directory-structure/app/middleware)

## Prerender
What: Render a route to HTML at build time, with `nuxt generate`, `routeRules` or `prerenderRoutes()`.
How: One word, as the API and config write it.
Avoid:
- pre-rendered: One word, as the API and config write it.
- pre-rendering: One word, as the API and config write it.
Good:
- Selective prerendering
Bad:
- Selective pre-rendering
Links:
- [Prerendering](https://nuxt.com/docs/getting-started/prerendering)

## Auto-import
What: A Nuxt feature that makes components, composables, utilities and Vue APIs available without an `import` statement.
How: Hyphenated as noun and verb: "auto-imports", "auto-imported". The config key is `imports`.
Avoid:
- auto imported: Hyphenated, as in "auto-imported".
- automatically imported: Use "auto-imported".
Good:
- Use auto-imported composables
Bad:
- Use auto imported composables
Links:
- [Auto-imports](https://nuxt.com/docs/guide/concepts/auto-imports)
