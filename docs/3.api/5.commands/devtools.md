---
title: "nuxi devtools"
description: The devtools command allows you to enable or disable Nuxt Devtools on a per-project basis.
---

# `nuxi devtools`

```{bash}
npx nuxi devtools enable|disable [rootDir]
```

Running `nuxi devtools enable` will install the Nuxt DevTools globally, and also enable it within the particular project you are using. It is saved as a preference in your user-level `.nuxtrc`. If you want to remove devtools support for a particular project, you can run `nuxi devtools disable`.

Option        | Default          | Description
-------------------------|-----------------|------------------
`rootDir` | `.` | The root directory of the app you want to enable devtools for.

::ReadMore{link="https://github.com/nuxt/devtools"}
::
