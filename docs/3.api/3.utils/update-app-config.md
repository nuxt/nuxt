# `updateAppConfig`

Updates [app config](/docs/guide/directory-structure/app-config) with deep assignment. Existing (nested) properties will preserve.

**Usage:**

```js
const appConfig = useAppConfig() // { foo: 'bar' }

const newAppConfig = { foo: 'baz' }

updateAppConfig(newAppConfig)

console.log(appConfig) // { foo: 'baz' }
```

::ReadMore{link="/docs/guide/directory-structure/app-config"}
