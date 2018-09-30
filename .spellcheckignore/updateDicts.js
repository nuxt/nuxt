const { outputFile, readFile, readdir, stat, readJson } = require('fs-extra')
const { join } = require('path')
const { sortedUniq, union } = require('lodash')
const concat = (head, ...tail) => head.concat(...tail)

const dictsDir = join(__dirname, 'dicts')
const cacheFile = join(__dirname, 'cache.tsv')
const depCacheFile = join(__dirname, 'dependencyCache.tsv')
const packageFile = join(__dirname, '../package.json')

const notExistsHandler = err => {
  if (err.code === 'ENOENT') return false
  else throw err
}

const readLines = path => readFile(path, 'utf8').then(s => s.split('\n'))
const writeLines = (path, contents) => outputFile(path, contents.join('\n'))
const id = x => x
const trim = lines => lines.map(line => line.trim()).filter(id)
const sort = lines => sortedUniq(lines.sort())

const nameEx = /[a-z]+/g
const readPackage = async () => {
  const { dependencies, devDependencies } = await readJson(packageFile)

  const dependencyNames = new Set()
  for (const bag of [dependencies, devDependencies]) {
    for (const key in bag) {
      for (const part of key.match(nameEx)) dependencyNames.add(part)
    }
  }
  return sort(Array.from(dependencyNames))
}

const main = async () => {
  const dictNames = readdir(dictsDir)
  const cacheFileStatPromise = stat(cacheFile).catch(notExistsHandler)
  const depCacheFileStatPromise = stat(depCacheFile).catch(notExistsHandler)
  const packageFileStatPromise = stat(packageFile)
  const fullPaths = (await dictNames).map(dictName => join(dictsDir, dictName))
  const dictStatPromises = fullPaths.map(path => stat(path))
  const cacheFileStat = await cacheFileStatPromise
  const isDirtyPromises = cacheFileStat
    ? dictStatPromises.map(dsp =>
        dsp.then(ds => ds.mtime > cacheFileStat.mtime)
      )
    : new Array(fullPaths.length).fill(
        Promise.resolve(true),
        0,
        fullPaths.length
      )
  const depCacheFileStat = await depCacheFileStatPromise
  const isDirtyDepCache =
    !cacheFileStat || depCacheFileStat.mtime > cacheFileStat.mtime
  const packageFileStat = await packageFileStatPromise
  const isDirtyPackage =
    !depCacheFileStat || packageFileStat.mtime > depCacheFileStat.mtime

  const depCacheContents = await (isDirtyPackage
    ? readPackage()
    : readLines(depCacheFile))

  if (isDirtyPackage) {
    writeLines(depCacheFile, depCacheContents)
  }

  const isDirtyArray = await Promise.all(isDirtyPromises)
  const dirtyOutput = isDirtyPackage || isDirtyDepCache || isDirtyArray.some(id)
  if (!dirtyOutput) {
    return
  }
  const dictsContentsPromises = fullPaths.map(readLines)

  const cleanDictsContents = dictsContentsPromises.map(
    (lines, i) =>
      isDirtyArray[i] ? lines.then(lines => sort(trim(lines))) : lines
  )
  const cleanWritePromises = cleanDictsContents.map(
    (clean, i) =>
      isDirtyArray[i]
        ? clean.then(clean => writeLines(fullPaths[i], clean))
        : undefined
  )
  const cleanCacheContents = sortedUniq(
    union(depCacheContents,...(await Promise.all(cleanDictsContents))).sort()
  )

  await Promise.all(cleanWritePromises)
  await writeLines(cacheFile, cleanCacheContents)
}
main()
