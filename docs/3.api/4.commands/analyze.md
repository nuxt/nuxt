---
title: "nuxi analyze"
description: "Analyze the production bundle or your Nuxt application."
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/analyze.ts
    size: xs
---

```bash [Terminal]
npx nuxi analyze [--log-level] [rootDir]
```

The `analyze` command builds Nuxt and analyzes the production bundle (experimental).

Option        | Default          | Description
-------------------------|-----------------|------------------
`rootDir` | `.` | The directory of the target application.

::callout
This command sets `process.env.NODE_ENV` to `production`.
::
