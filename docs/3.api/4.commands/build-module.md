---
title: 'nuxi build-module'
description: 'Nuxt command to build your Nuxt module before publishing.'
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/build-module.ts
    size: xs
---

```bash [Terminal]
npx nuxi build-module [--stub] [rootDir]
```

The `build-module` command runs `@nuxt/module-builder` to generate `dist` directory within your `rootDir` that contains the full build for your **nuxt-module**.

Option        | Default          | Description
-------------------------|-----------------|------------------
`rootDir` | `.` | The root directory of the module to bundle.
`--stub` | `false` | Stub out your module for development using [jiti](https://github.com/unjs/jiti#jiti). (**note:** This is mainly for development purposes.)

::read-more{to="https://github.com/nuxt/module-builder" icon="i-simple-icons-github" color="gray" target="_blank"}
Read more about `@nuxt/module-builder`.
::
