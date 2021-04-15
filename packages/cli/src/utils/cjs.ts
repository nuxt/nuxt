export function resolveModule (id, paths?) {
  return require.resolve(id, {
    paths: [].concat(
      // @ts-ignore
      global.__NUXT_PREPATHS__,
      paths,
      process.cwd(),
      // @ts-ignore
      global.__NUXT_PATHS__
    ).filter(Boolean)
  })
}

export function requireModule (id, paths?) {
  return require(resolveModule(id, paths))
}
