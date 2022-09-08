# `nuxi prepare`

```{bash}
npx nuxi prepare [rootDir]
```

The `prepare` command creates a `.nuxt` directory in your application and generates types. This can be useful in a CI environment or as a `postinstall` command in your `package.json`.

Option        | Default          | Description
-------------------------|-----------------|------------------
`rootDir` | `.` | The root directory of the application to prepare.
