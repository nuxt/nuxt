---
title: "nuxi init"
description: The init command initializes a fresh Nuxt project.
---

# `nuxi init`

```{bash}
npx nuxi init|create [--verbose|-v] [--template,-t] [dir]
```

The `init` command initializes a fresh Nuxt project using [unjs/giget](https://github.com/unjs/giget).

## Options

Option        | Default          | Description
-------------------------|-----------------|------------------
`--template, -t` | `v3` | Specify template name or git repository to use as a template. Format is `gh:org/name` to use a custom github template.
`--force`      | `false` | Force clone to any existing directory.
`--offline`   | `false` | Do not attempt to download from github and only use local cache.
`--prefer-offline` | `false` | Try local cache first to download templates.
`--shell` | `false` | Open shell in cloned directory (experimental).

## Environment variables

- `NUXI_INIT_REGISTRY`: Set to a custom template registry. ([learn more](https://github.com/unjs/giget#custom-registry)).
  - Default registry is loaded from [nuxt/starter/templates](https://github.com/nuxt/starter/tree/templates/templates)
