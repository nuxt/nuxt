---
title: 'nuxi cleanup'
description: "Remove common generated Nuxt files and caches."
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/cleanup.ts
    size: xs
---

```bash [Terminal]
npx nuxi clean|cleanup [rootDir]
```

The `cleanup` command removes common generated Nuxt files and caches, including:
- `.nuxt`
- `.output`
- `node_modules/.vite`
- `node_modules/.cache`

Option        | Default          | Description
-------------------------|-----------------|------------------
`rootDir` | `.` | The root directory of the project.
