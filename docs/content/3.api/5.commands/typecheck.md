---
title: "nuxi typecheck"
description: The typecheck command runs vue-tsc to check types throughout your app.
---

# `nuxi typecheck`

```{bash}
npx nuxi typecheck [rootDir]
```

The `typecheck` command runs [`vue-tsc`](https://github.com/johnsoncodehk/volar/tree/master/packages/vue-tsc) to check types throughout your app.

Option        | Default          | Description
-------------------------|-----------------|------------------
`rootDir` | `.` | The directory of the target application.

This command sets `process.env.NODE_ENV` to `production`. To override, define `NODE_ENV` in a `.env` file or as a command-line argument.

::alert
You can also enable type-checking at build or development time by installing `vue-tsc` and `typescript` as devDependencies and enabling [the `typescript.typeCheck` option in your `nuxt.config` file](/api/configuration/nuxt-config#typescript).
::
