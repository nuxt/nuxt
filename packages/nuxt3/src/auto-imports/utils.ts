import type { AutoImport } from '@nuxt/kit'

export function toImports (autoImports: AutoImport[], isCJS = false) {
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

export function filterInPlace<T> (arr: T[], predicate: (v: T) => any) {
  let i = arr.length
  while (i--) {
    if (!predicate(arr[i])) {
      arr.splice(i, 1)
    }
  }
}
