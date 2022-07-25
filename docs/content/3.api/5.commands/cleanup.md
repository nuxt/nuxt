# `nuxi cleanup`

```{bash}
npx nuxi clean|cleanup [rootDir]
```

The `cleanup` command, removes common generated nuxt files and caches. Including:

- `.nuxt`
- `.output`
- `node_modules/.vite`
- `node_modules/.cache`

Option        | Default          | Description
-------------------------|-----------------|------------------
`rootDir` | `.` | The root directory of the project.
