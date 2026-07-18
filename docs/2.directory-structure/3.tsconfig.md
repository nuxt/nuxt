---
title: "tsconfig.json"
description: "Learn how Nuxt manages TypeScript configuration across different parts of your project."
head.title: "tsconfig.json"
navigation.icon: i-vscode-icons-file-type-tsconfig
---

Nuxt [automatically generates](/docs/4.x/guide/concepts/typescript#auto-generated-types) multiple TypeScript configuration files (`.nuxt/tsconfig.app.json`, `.nuxt/tsconfig.server.json`, `.nuxt/tsconfig.node.json` and `.nuxt/tsconfig.shared.json`) that include recommended basic TypeScript configuration for your project, references to [auto-imports](/docs/4.x/guide/concepts/auto-imports), [API route types](/docs/4.x/guide/concepts/server-engine#typed-api-routes), path aliases, and more.

Your Nuxt project should include the following `tsconfig.json` file at the root of the project:

```json [tsconfig.json]
{
  "files": [],
  "references": [
    {
      "path": "./.nuxt/tsconfig.app.json"
    },
    {
      "path": "./.nuxt/tsconfig.server.json"
    },
    {
      "path": "./.nuxt/tsconfig.shared.json"
    },
    {
      "path": "./.nuxt/tsconfig.node.json"
    }
  ]
}
```

::warning
We do not recommend modifying the contents of this file directly, as doing so could overwrite important settings that Nuxt or other modules rely on. Instead, extend it via `nuxt.config.ts`.
::

::read-more{to="/docs/4.x/guide/concepts/typescript#project-references"}
Read more about the different type contexts of a Nuxt project here.
::

## Extending TypeScript Configuration

You can customize the TypeScript configuration of your Nuxt project for each context (`app`, `shared`, `node`, and `server`) in the `nuxt.config.ts` file.
<!-- @case-police-ignore tsConfig -->
```ts twoslash [nuxt.config.ts]
// @errors: 2353
export default defineNuxtConfig({
  typescript: {
    // customize tsconfig.app.json
    tsConfig: {
      // ...
    },
    // customize tsconfig.shared.json
    sharedTsConfig: {
      // ...
    },
    // customize tsconfig.node.json
    nodeTsConfig: {
      // ...
    },
  },
  nitro: {
    typescript: {
      // customize tsconfig.server.json
      tsConfig: {
        // ...
      },
    },
  },
})
```
