---
title: "nuxi generate"
description: Pre-renders every application route and stores the result in plain HTML files.
---

# `nuxi generate`

```{bash}
npx nuxi generate [rootDir] [--dotenv]
```

The `generate` command pre-renders every route of your application and stores the result in plain HTML files that you can deploy on any static hosting service. It triggers the `nuxi build` command with the `prerender` argument set to `true`

Option        | Default          | Description
-------------------------|-----------------|------------------
`rootDir` | `.` | The root directory of the application to generate
`--dotenv` | `.` | Point to another `.env` file to load, **relative** to the root directory.
