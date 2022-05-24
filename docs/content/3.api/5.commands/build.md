# `nuxi build`

```{bash}
npx nuxi build [rootDir]
```

The `build` command creates a `.output` directory with all your application, server and dependencies ready for production.

Option        | Default          | Description
-------------------------|-----------------|------------------
`rootDir` | `.` | The root directory of the application to bundle.
`prerender` | `false` | Pre-render every route of your application. (**note:** This is an experimental flag. The behavior might be changed.)

This command sets `process.env.NODE_ENV` to `production`. To override, define `NODE_ENV` in a `.env` file or as command-line argument.
