---
title: "nuxi upgrade"
description: The upgrade command upgrades Nuxt 3 to the latest version.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/upgrade.ts
    size: xs
---

```bash [Terminal]
npx nuxi upgrade [--force|-f]
```

The `upgrade` command upgrades Nuxt 3 to the latest version.

Option        | Default          | Description
-------------------------|-----------------|------------------
`--force, -f` | `false` | Removes `node_modules` and lock files before upgrade.
