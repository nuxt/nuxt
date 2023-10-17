---
description: "Remove common generated Nuxt files and caches."
---
# `nuxi cleanup`

```{bash}
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
