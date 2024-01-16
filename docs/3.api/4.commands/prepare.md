---
title: 'nuxi prepare'
description: The prepare command creates a .nuxt directory in your application and generates types.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/prepare.ts
    size: xs
---

```bash [Terminal]
npx nuxi prepare [--log-level] [rootDir]
```

The `prepare` command creates a [`.nuxt`](/docs/guide/directory-structure/nuxt) directory in your application and generates types. This can be useful in a CI environment or as a `postinstall` command in your [`package.json`](/docs/guide/directory-structure/package).

Option        | Default          | Description
-------------------------|-----------------|------------------
`rootDir` | `.` | The root directory of the application to prepare.
