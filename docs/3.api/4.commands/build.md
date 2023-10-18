---
title: "nuxi build"
description: "Build your Nuxt application."
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/build.ts
    size: xs
---

```bash [Terminal]
npx nuxi build [--prerender] [--dotenv] [--log-level] [rootDir]
```

The `build` command creates a `.output` directory with all your application, server and dependencies ready for production.

Option        | Default          | Description
-------------------------|-----------------|------------------
`rootDir` | `.` | The root directory of the application to bundle.
`--prerender` | `false` | Pre-render every route of your application. (**note:** This is an experimental flag. The behavior might be changed.)
`--dotenv` | `.` | Point to another `.env` file to load, **relative** to the root directory.

::callout
This command sets `process.env.NODE_ENV` to `production`.
::
