---
title: "nuxi generate"
description: Pre-renders every route of the application and stores the result in plain HTML files.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/generate.ts
    size: xs
---

```bash [Terminal]
npx nuxi generate [rootDir] [--dotenv]
```

The `generate` command pre-renders every route of your application and stores the result in plain HTML files that you can deploy on any static hosting services. The command triggers the `nuxi build` command with the `prerender` argument set to `true`

Option        | Default          | Description
-------------------------|-----------------|------------------
`rootDir` | `.` | The root directory of the application to generate
`--dotenv` | `.` | Point to another `.env` file to load, **relative** to the root directory.

::read-more{to="/docs/getting-started/deployment#static-hosting"}
Read more about pre-rendering and static hosting.
::
