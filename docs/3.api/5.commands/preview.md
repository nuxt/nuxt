---
title: "nuxi preview"
description: The preview command starts a server to preview your application after the build command.
---

# `nuxi preview`

```{bash}
npx nuxi preview [rootDir] [--dotenv]
```

The `preview` command starts a server to preview your Nuxt application after running the `build` command. The `start` command is an alias for `preview`. When running your application in production refer to the [Deployment section](/docs/getting-started/deployment).

Option        | Default          | Description
-------------------------|-----------------|------------------
`rootDir` | `.` | The root directory of the application to preview.
`--dotenv` | `.` | Point to another `.env` file to load, **relative** to the root directory.

This command sets `process.env.NODE_ENV` to `production`. To override, define `NODE_ENV` in a `.env` file or as command-line argument.

::alert{type=info}
For convenience, in preview mode, your `.env` file will be loaded into `process.env`. (However, in production you will need to ensure your environment variables are set yourself.)
::
