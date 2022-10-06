---
title: "nuxi analyze"
description: "Analyze the production bundle or your Nuxt application."
---

# `nuxi analyze`

```{bash}
npx nuxi analyze [rootDir]
```

The `analyze` command builds Nuxt and analyzes the production bundle (experimental).

Option        | Default          | Description
-------------------------|-----------------|------------------
`rootDir` | `.` | The directory of the target application.

This command sets `process.env.NODE_ENV` to `production`.
