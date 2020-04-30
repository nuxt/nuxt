export function maybeResolve (name) {
  try {
    return require.resolve(name)
  } catch {
    return name
  }
}
