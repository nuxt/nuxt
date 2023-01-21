---
title: "nuxi upgrade"
description: The upgrade command upgrades Nuxt 3 to the latest version.
---

# `nuxi upgrade`

```{bash}
npx nuxi upgrade [--force|-f] [--channel]
```

The `upgrade` command upgrades Nuxt to the latest version.

Use `--channel` flag to switch between stable and edge package versions. Possible values are `stable` and `edge`

Option        | Default          | Description
-------------------------|-----------------|------------------
`--force, -f` | `false` | Removes `node_modules` and lock files before upgrade.
`--channel` | - | Switches between edge and stable release channels.
