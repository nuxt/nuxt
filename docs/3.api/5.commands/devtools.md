---
title: "nuxi devtools"
description: The devtools command allows you to toggle Nuxt DevTools per project.
---

# `nuxi devtools`

```{bash}
npx nuxi devtools enable|disable [rootDir]
```

Running `nuxi devtools enable` will install the Nuxt DevTools globally and also enable it within the particular project you are using. It saves as a preference in your user-level `.nuxtrc`. If you want to remove devtools support for a specific project, you can run `nuxi devtools disable`.

Option        | Default          | Description
-------------------------|-----------------|------------------
`rootDir` | `.` | The app root directory you want to enable devtools for.

::ReadMore{link="https://github.com/nuxt/devtools"}
::
