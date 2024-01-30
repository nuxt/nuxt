---
title: 'updateAppConfig'
description: 'Update the App Config at runtime.'
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/config.ts
    size: xs
---

::callout
Updates the [`app.config`](/docs/guide/directory-structure/app-config) using deep assignment. Existing (nested) properties will be preserved.
::

## Usage

```js
const appConfig = useAppConfig() // { foo: 'bar' }

const newAppConfig = { foo: 'baz' }

updateAppConfig(newAppConfig)

console.log(appConfig) // { foo: 'baz' }
```

:read-more{to="/docs/guide/directory-structure/app-config"}
