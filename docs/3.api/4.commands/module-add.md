---
title: "nuxi module add"
description: "Add a Nuxt module to your Nuxt application."
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/module/add.ts
    size: xs
---

```bash [Terminal]
npx nuxi module add <NAME>
```
The `module add` command allows you to install [Nuxt modules](/modules) directly to your application with minimal manual work. It automatically updates your [`nuxt.config`](/docs/guide/directory-structure/nuxt-config) file with each module you add.

Option        | Default          | Description
-------------------------|-----------------|------------------
`NAME` | - | The name of the module to install.

## Example usage

Installing the [`Pinia`](/modules/pinia) module
```bash [Terminal]
npx nuxi module add pinia 
```

Your `nuxt config` should now look like this:

```ts [nuxt.config.ts]
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: ['@pinia/nuxt']
})
