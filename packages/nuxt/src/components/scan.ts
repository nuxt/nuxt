import { readdir } from 'node:fs/promises'
import { basename, dirname, extname, join, relative } from 'pathe'
import { globby } from 'globby'
import { pascalCase, splitByCase } from 'scule'
import { isIgnored, logger, useNuxt } from '@nuxt/kit'
// eslint-disable-next-line vue/prefer-import-from-vue
import { hyphenate } from '@vue/shared'
import { withTrailingSlash } from 'ufo'
import type { Component, ComponentsDir } from 'nuxt/schema'

/**
 * Scan the components inside different components folders
 * and return a unique list of components
 *
 * @param dirs all folders where components are defined
 * @param srcDir src path of your app
 * @returns {Promise} Component found promise
 */
export async function scanComponents (dirs: ComponentsDir[], srcDir: string): Promise<Component[]> {
  // All scanned components
  const components: Component[] = []

  // Keep resolved path to avoid duplicates
  const filePaths = new Set<string>()

  // All scanned paths
  const scannedPaths: string[] = []

  for (const dir of dirs) {
    // A map from resolved path to component name (used for making duplicate warning message)
    const resolvedNames = new Map<string, string>()

    const files = (await globby(dir.pattern!, { cwd: dir.path, ignore: dir.ignore })).sort()

    // Check if the directory exists (globby will otherwise read it case insensitively on MacOS)
    if (files.length) {
      const siblings = await readdir(dirname(dir.path)).catch(() => [] as string[])

      const directory = basename(dir.path)
      if (!siblings.includes(directory)) {
        const directoryLowerCase = directory.toLowerCase()
        const caseCorrected = siblings.find(sibling => sibling.toLowerCase() === directoryLowerCase)
        if (caseCorrected) {
          const nuxt = useNuxt()
          const original = relative(nuxt.options.srcDir, dir.path)
          const corrected = relative(nuxt.options.srcDir, join(dirname(dir.path), caseCorrected))
          logger.warn(`Components not scanned from \`~/${corrected}\`. Did you mean to name the directory \`~/${original}\` instead?`)
          continue
        }
      }
    }

    for (const _file of files) {
      const filePath = join(dir.path, _file)

      if (scannedPaths.find(d => filePath.startsWith(withTrailingSlash(d))) || isIgnored(filePath)) {
        continue
      }

      // Avoid duplicate paths
      if (filePaths.has(filePath)) { continue }

      filePaths.add(filePath)

      /**
       * Create an array of prefixes base on the prefix config
       * Empty prefix will be an empty array
       *
       * @example prefix: 'nuxt' -> ['nuxt']
       * @example prefix: 'nuxt-test' -> ['nuxt', 'test']
       */
      const prefixParts = ([] as string[]).concat(
        dir.prefix ? splitByCase(dir.prefix) : [],
        (dir.pathPrefix !== false) ? splitByCase(relative(dir.path, dirname(filePath))) : []
      )

      /**
       * In case we have index as filename the component become the parent path
       *
       * @example third-components/index.vue -> third-component
       * if not take the filename
       * @example third-components/Awesome.vue -> Awesome
       */
      let fileName = basename(filePath, extname(filePath))

      const island = /\.(island)(\.global)?$/.test(fileName) || dir.island
      const global = /\.(global)(\.island)?$/.test(fileName) || dir.global
      const mode = island ? 'server' : (fileName.match(/(?<=\.)(client|server)(\.global|\.island)*$/)?.[1] || 'all') as 'client' | 'server' | 'all'
      fileName = fileName.replace(/(\.(client|server))?(\.global|\.island)*$/, '')

      if (fileName.toLowerCase() === 'index') {
        fileName = dir.pathPrefix === false ? basename(dirname(filePath)) : '' /* inherits from path */
      }

      const suffix = (mode !== 'all' ? `-${mode}` : '')
      const componentName = resolveComponentName(fileName, prefixParts)

      if (resolvedNames.has(componentName + suffix) || resolvedNames.has(componentName)) {
        warnAboutDuplicateComponent(componentName, filePath, resolvedNames.get(componentName) || resolvedNames.get(componentName + suffix)!)
        continue
      }
      resolvedNames.set(componentName + suffix, filePath)

      const pascalName = pascalCase(componentName).replace(/["']/g, '')
      const kebabName = hyphenate(componentName)
      const shortPath = relative(srcDir, filePath)
      const chunkName = 'components/' + kebabName + suffix

      let component: Component = {
        // inheritable from directory configuration
        mode,
        global,
        island,
        prefetch: Boolean(dir.prefetch),
        preload: Boolean(dir.preload),
        // specific to the file
        filePath,
        pascalName,
        kebabName,
        chunkName,
        shortPath,
        export: 'default',
        // by default, give priority to scanned components
        priority: dir.priority ?? 1
      }

      if (typeof dir.extendComponent === 'function') {
        component = (await dir.extendComponent(component)) || component
      }

      // Ignore files like `~/components/index.vue` which end up not having a name at all
      if (!componentName) {
        logger.warn(`Component did not resolve to a file name in \`~/${relative(srcDir, filePath)}\`.`)
        continue
      }

      const existingComponent = components.find(c => c.pascalName === component.pascalName && ['all', component.mode].includes(c.mode))
      // Ignore component if component is already defined (with same mode)
      if (existingComponent) {
        const existingPriority = existingComponent.priority ?? 0
        const newPriority = component.priority ?? 0

        // Replace component if priority is higher
        if (newPriority > existingPriority) {
          components.splice(components.indexOf(existingComponent), 1, component)
        }
        // Warn if a user-defined (or prioritized) component conflicts with a previously scanned component
        if (newPriority > 0 && newPriority === existingPriority) {
          warnAboutDuplicateComponent(componentName, filePath, existingComponent.filePath)
        }

        continue
      }

      components.push(component)
    }
    scannedPaths.push(dir.path)
  }

  return components
}

export function resolveComponentName (fileName: string, prefixParts: string[]) {
  /**
   * Array of fileName parts splitted by case, / or -
   *
   * @example third-component -> ['third', 'component']
   * @example AwesomeComponent -> ['Awesome', 'Component']
   */
  const fileNameParts = splitByCase(fileName)
  const fileNamePartsContent = fileNameParts.join('/').toLowerCase()
  const componentNameParts: string[] = [...prefixParts]
  let index = prefixParts.length - 1
  const matchedSuffix: string[] = []
  while (index >= 0) {
    matchedSuffix.unshift(...splitByCase(prefixParts[index] || '').map(p => p.toLowerCase()))
    const matchedSuffixContent = matchedSuffix.join('/')
    if ((fileNamePartsContent === matchedSuffixContent || fileNamePartsContent.startsWith(matchedSuffixContent + '/')) ||
      // e.g Item/Item/Item.vue -> Item
      (prefixParts[index].toLowerCase() === fileNamePartsContent &&
        prefixParts[index + 1] &&
        prefixParts[index] === prefixParts[index + 1])) {
      componentNameParts.length = index
    }
    index--
  }

  return pascalCase(componentNameParts) + pascalCase(fileNameParts)
}

function warnAboutDuplicateComponent (componentName: string, filePath: string, duplicatePath: string) {
  logger.warn(`Two component files resolving to the same name \`${componentName}\`:\n` +
    `\n - ${filePath}` +
    `\n - ${duplicatePath}`
  )
}
