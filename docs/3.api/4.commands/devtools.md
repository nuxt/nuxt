---
title: "nuxt devtools"
description: The devtools command allows you to enable or disable Nuxt DevTools on a per-project basis.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/packages/nuxi/src/commands/devtools.ts
    size: xs
---

<!--devtools-cmd-->
```bash [Terminal]
npx nuxt devtools <COMMAND> [ROOTDIR] [--cwd=<directory>]
```
<!--/devtools-cmd-->

Running `nuxt devtools enable` will install the Nuxt DevTools globally, and also enable it within the particular project you are using. It is saved as a preference in your user-level `.nuxtrc`. If you want to remove devtools support for a particular project, you can run `nuxt devtools disable`.

## Arguments

<!--devtools-args-->
Argument | Description
--- | ---
`COMMAND` | Command to run (options: <enable\|disable>)
`ROOTDIR="."` | Specifies the working directory (default: `.`)
<!--/devtools-args-->

## Options

<!--devtools-opts-->
Option | Default | Description
--- | --- | ---
`--cwd=<directory>` |  | Specify the working directory, this takes precedence over ROOTDIR (default: `.`)
<!--/devtools-opts-->

::read-more{icon="i-simple-icons-nuxtdotjs" to="https://devtools.nuxt.com" target="\_blank"}
Read more about the **Nuxt DevTools**.
::
