# `nuxi init`

```{bash}
npx nuxi init|create [--verbose|-v] [--template,-t] [dir]
```

The `init` command initializes a fresh Nuxt project.

Option        | Default          | Description
-------------------------|-----------------|------------------
`--template, -t` | `nuxt/starter#v3` | Specify a Git repository to use as a template.
`--force`      | `false` | Force clone to any existing directory.
`--offline`   | `false` | Do not attempt to download from github and only use local cache.
`--prefer-offline` | `false` | Try local cache first. (might be outdated)
`--shell` | `false` | (experimental) Open shell in cloned directory.
`dir` | `nuxt-app` | Name of the install directory.
