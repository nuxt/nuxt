# `nuxi build`

```{bash}
npx nuxi build [rootDir] [--prerender] [--dotenv]
```

The `build` command creates a `.output` directory with all your application, server and dependencies ready for production.

Option        | Default          | Description
-------------------------|-----------------|------------------
`rootDir` | `.` | The root directory of the application to bundle.
`--prerender` | `false` | Pre-render every route of your application. (**note:** This is an experimental flag. The behavior might be changed.)
`--dotenv` | `.` | Point to another `.env` file to load, **relative** to the root directory.

This command sets `process.env.NODE_ENV` to `production`.
