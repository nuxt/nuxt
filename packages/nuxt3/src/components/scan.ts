import { basename, extname, join, dirname, relative } from 'pathe'
import globby from 'globby'
import { pascalCase, splitByCase } from 'scule'
import type { ScanDir, Component } from '@nuxt/kit'

export function sortDirsByPathLength ({ path: pathA }: ScanDir, { path: pathB }: ScanDir): number {
  return pathB.split(/[\\/]/).filter(Boolean).length - pathA.split(/[\\/]/).filter(Boolean).length
}

// vue@2 src/shared/util.js
// TODO: update to vue3?
function hyphenate (str: string):string {
  return str.replace(/\B([A-Z])/g, '-$1').toLowerCase()
}

export async function scanComponents (dirs: ScanDir[], srcDir: string): Promise<Component[]> {
  const components: Component[] = []
  const filePaths = new Set<string>()
  const scannedPaths: string[] = []

  for (const { path, pattern, ignore = [], prefix, extendComponent, pathPrefix, level, prefetch = false, preload = false } of dirs.sort(sortDirsByPathLength)) {
    const resolvedNames = new Map<string, string>()

    for (const _file of await globby(pattern!, { cwd: path, ignore })) {
      const filePath = join(path, _file)

      if (scannedPaths.find(d => filePath.startsWith(d))) {
        continue
      }

      if (filePaths.has(filePath)) { continue }
      filePaths.add(filePath)

      // Resolve componentName
      const prefixParts = ([] as string[]).concat(
        prefix ? splitByCase(prefix) : [],
        (pathPrefix !== false) ? splitByCase(relative(path, dirname(filePath))) : []
      )
      let fileName = basename(filePath, extname(filePath))
      if (fileName.toLowerCase() === 'index') {
        fileName = pathPrefix === false ? basename(dirname(filePath)) : '' /* inherits from path */
      }
      const fileNameParts = splitByCase(fileName)

      const componentNameParts: string[] = []

      while (prefixParts.length &&
        (prefixParts[0] || '').toLowerCase() !== (fileNameParts[0] || '').toLowerCase()
      ) {
        componentNameParts.push(prefixParts.shift()!)
      }

      const componentName = pascalCase(componentNameParts) + pascalCase(fileNameParts)

      if (resolvedNames.has(componentName)) {
        // eslint-disable-next-line no-console
        console.warn(`Two component files resolving to the same name \`${componentName}\`:\n` +
          `\n - ${filePath}` +
          `\n - ${resolvedNames.get(componentName)}`
        )
        continue
      }
      resolvedNames.set(componentName, filePath)

      const pascalName = pascalCase(componentName).replace(/["']/g, '')
      const kebabName = hyphenate(componentName)
      const shortPath = relative(srcDir, filePath)
      const chunkName = 'components/' + kebabName

      let component: Component = {
        filePath,
        pascalName,
        kebabName,
        chunkName,
        shortPath,
        export: 'default',
        global: Boolean(global),
        level: Number(level),
        prefetch: Boolean(prefetch),
        preload: Boolean(preload)
      }

      if (typeof extendComponent === 'function') {
        component = (await extendComponent(component)) || component
      }

      // Check if component is already defined, used to overwite if level is inferiour
      const definedComponent = components.find(c => c.pascalName === component.pascalName)
      if (definedComponent && component.level < definedComponent.level) {
        Object.assign(definedComponent, component)
      } else if (!definedComponent) {
        components.push(component)
      }
    }

    scannedPaths.push(path)
  }

  return components
}
