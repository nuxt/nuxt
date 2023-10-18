---
title: "nuxi devtools"
description: The devtools command allows you to enable or disable Nuxt DevTools on a per-project basis.
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/cli/blob/main/src/commands/devtools.ts
    size: xs
---

```bash [Terminal]
npx nuxi devtools enable|disable [rootDir]
```

Running `nuxi devtools enable` will install the Nuxt DevTools globally, and also enable it within the particular project you are using. It is saved as a preference in your user-level `.nuxtrc`. If you want to remove devtools support for a particular project, you can run `nuxi devtools disable`.

Option        | Default          | Description
-------------------------|-----------------|------------------
`rootDir` | `.` | The root directory of the app you want to enable devtools for.

::read-more{icon="i-simple-icons-nuxtdotjs" to="https://devtools.nuxt.com" target="_blank"}
Read more about the **Nuxt DevTools**.
::
