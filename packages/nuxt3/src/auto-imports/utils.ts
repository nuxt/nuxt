import type { AutoImport } from '@nuxt/schema'

export function toImportModuleMap (autoImports: AutoImport[], isCJS = false) {
  const aliasKeyword = isCJS ? ' : ' : ' as '
  const map: Record<string, Set<string>> = {}
  for (const autoImport of autoImports) {
    if (!map[autoImport.from]) {
      map[autoImport.from] = new Set()
    }
    map[autoImport.from].add(
      autoImport.name === autoImport.as
        ? autoImport.name
        : autoImport.name + aliasKeyword + autoImport.as
    )
  }
  return map
}

export function toImports (autoImports: AutoImport[], isCJS = false) {
  const map = toImportModuleMap(autoImports, isCJS)
  if (isCJS) {
    return Object.entries(map)
      .map(([name, imports]) => `const { ${Array.from(imports).join(', ')} } = require('${name}');`)
      .join('\n')
  } else {
    return Object.entries(map)
      .map(([name, imports]) => `import { ${Array.from(imports).join(', ')} } from '${name}';`)
      .join('\n')
  }
}

export function toExports (autoImports: AutoImport[]) {
  const map = toImportModuleMap(autoImports, false)
  return Object.entries(map)
    .map(([name, imports]) => `export { ${Array.from(imports).join(', ')} } from '${name}';`)
    .join('\n')
}

export function filterInPlace<T> (arr: T[], predicate: (v: T) => any) {
  let i = arr.length
  while (i--) {
    if (!predicate(arr[i])) {
      arr.splice(i, 1)
    }
  }
}
