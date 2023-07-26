# `updateAppConfig`

Updates [app config](/docs/guide/directory-structure/app-config) using deep assignment. Existing (nested) properties will be preserved.

**Usage:**

```js
const appConfig = useAppConfig() // { foo: 'bar' }

const newAppConfig = { foo: 'baz' }

updateAppConfig(newAppConfig)

console.log(appConfig) // { foo: 'baz' }
```

::ReadMore{link="/docs/guide/directory-structure/app-config"}
