---
title: "nuxi typecheck"
description: The typecheck command runs vue-tsc to check types throughout your app.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/typecheck.ts
    size: xs
---

```bash [Terminal]
npx nuxi typecheck [--log-level] [rootDir]
```

The `typecheck` command runs [`vue-tsc`](https://github.com/vuejs/language-tools/tree/master/packages/vue-tsc) to check types throughout your app.

Option        | Default          | Description
-------------------------|-----------------|------------------
`rootDir` | `.` | The directory of the target application.

::callout
This command sets `process.env.NODE_ENV` to `production`. To override, define `NODE_ENV` in a [`.env`](/docs/guide/directory-structure/env) file or as a command-line argument.
::

::read-more{to="/docs/guide/concepts/typescript#type-checking"}
Read more on how to enable type-checking at build or development time.
::
