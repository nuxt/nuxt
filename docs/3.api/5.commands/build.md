---
title: "nuxi build"
description: "Build your Nuxt application."
---

# `nuxi build`

```{bash}
npx nuxi build [--prerender] [--dotenv] [--log-level] [rootDir]
```

The `build` command creates a `.output` directory with all your application, server, and dependencies ready for production.

Option        | Default          | Description
-------------------------|-----------------|------------------
`rootDir` | `.` | The application's root directory to bundle.
`--prerender` | `false` | Pre-render every route of your application. (**note:** This is an experimental flag. The behavior might change.)
`--dotenv` | `.` | Point to another `.env` file to load, **relative** to the root directory.

This command sets `process.env.NODE_ENV` to `production`.
