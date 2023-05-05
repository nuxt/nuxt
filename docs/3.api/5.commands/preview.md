---
title: "nuxi preview"
description: The preview command starts a server to preview your application after the build command.
---

# `nuxi preview`

```{bash}
npx nuxi preview [rootDir] [--dotenv]
```

The `preview` command starts a server to preview your Nuxt application after the `build` command executes.

Option        | Default          | Description
-------------------------|-----------------|------------------
`rootDir` | `.` | The application's root directory to preview.
`--dotenv` | `.` | Point to another `.env` file to load, **relative** to the root directory.

This command sets `process.env.NODE_ENV` to `production`. To override, define `NODE_ENV` in a `.env` file or as a command-line argument.

::alert{type=info}
For convenience reasons, your `.env` file will be loaded into `process.env` in preview mode. (However, in production, you must ensure your environment variables get configured.)
::
