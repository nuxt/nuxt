---
title: 'updateAppConfig'
description: 'Update the App Config at runtime.'
links:
  - label: Source
    icon: i-simple-icons-github
    to: https://github.com/nuxt/nuxt/blob/main/packages/nuxt/src/app/config.ts
    size: xs
---

::note
Updates the [`app.config`](/docs/4.x/guide/directory-structure/app/app-config) using deep assignment. Existing (nested) properties will be preserved.
::

## Usage

```js
import { updateAppConfig, useAppConfig } from '#imports'

const appConfig = useAppConfig() // { foo: 'bar' }

const newAppConfig = { foo: 'baz' }
updateAppConfig(newAppConfig)

console.log(appConfig) // { foo: 'baz' }
```

:read-more{to="/docs/4.x/guide/directory-structure/app/app-config"}
