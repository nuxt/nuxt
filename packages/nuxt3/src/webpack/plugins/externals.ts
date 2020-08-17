import fs from 'fs'
import path from 'path'

function contains (arr, val) {
  return arr && arr.includes(val)
}

const atPrefix = new RegExp('^@', 'g')

function readDir (dirName) {
  if (!fs.existsSync(dirName)) {
    return []
  }

  try {
    return fs
      .readdirSync(dirName)
      .map(function (module) {
        if (atPrefix.test(module)) {
          // reset regexp
          atPrefix.lastIndex = 0
          try {
            return fs
              .readdirSync(path.join(dirName, module))
              .map(function (scopedMod) {
                return module + '/' + scopedMod
              })
          } catch (e) {
            return [module]
          }
        }
        return module
      })
      .reduce(function (prev, next) {
        return prev.concat(next)
      }, [])
  } catch (e) {
    return []
  }
}

function readFromPackageJson (options) {
  if (typeof options !== 'object') {
    options = {}
  }
  // read the file
  let packageJson
  try {
    const fileName = options.fileName || 'package.json'
    const packageJsonString = fs.readFileSync(
      path.join(process.cwd(), './' + fileName),
      'utf8'
    )
    packageJson = JSON.parse(packageJsonString)
  } catch (e) {
    return []
  }
  // sections to search in package.json
  let sections = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies'
  ]
  if (options.include) {
    sections = [].concat(options.include)
  }
  if (options.exclude) {
    sections = sections.filter(function (section) {
      return ![].concat(options.exclude).includes(section)
    })
  }
  // collect dependencies
  const deps = {}
  sections.forEach(function (section) {
    Object.keys(packageJson[section] || {}).forEach(function (dep) {
      deps[dep] = true
    })
  })
  return Object.keys(deps)
}

function containsPattern (arr, val) {
  return (
    arr &&
    arr.some(function (pattern) {
      if (pattern instanceof RegExp) {
        return pattern.test(val)
      } else if (typeof pattern === 'function') {
        return pattern(val)
      } else {
        return pattern === val
      }
    })
  )
}

const scopedModuleRegex = new RegExp(
  '@[a-zA-Z0-9][\\w-.]+/[a-zA-Z0-9][\\w-.]+([a-zA-Z0-9./]+)?',
  'g'
)

function getModuleName (request, includeAbsolutePaths) {
  let req = request
  const delimiter = '/'

  if (includeAbsolutePaths) {
    req = req.replace(/^.*?\/node_modules\//, '')
  }
  // check if scoped module
  if (scopedModuleRegex.test(req)) {
    // reset regexp
    scopedModuleRegex.lastIndex = 0
    return req.split(delimiter, 2).join(delimiter)
  }
  return req.split(delimiter)[0]
}

export default function nodeExternals (options) {
  options = options || {}
  const whitelist = [].concat(options.whitelist || [])
  const binaryDirs = [].concat(options.binaryDirs || ['.bin'])
  const importType = options.importType || 'commonjs'
  const modulesDir = options.modulesDir || 'node_modules'
  const modulesFromFile = !!options.modulesFromFile
  const includeAbsolutePaths = !!options.includeAbsolutePaths

  // helper function
  function isNotBinary (x) {
    return !contains(binaryDirs, x)
  }

  // create the node modules list
  const nodeModules = modulesFromFile
    ? readFromPackageJson(options.modulesFromFile)
    : readDir(modulesDir).filter(isNotBinary)

  // return an externals function
  return function ({ context: _context, request }, callback) {
    const moduleName = getModuleName(request, includeAbsolutePaths)
    if (
      contains(nodeModules, moduleName) &&
      !containsPattern(whitelist, request)
    ) {
      if (typeof importType === 'function') {
        return callback(null, importType(request))
      }
      // mark this module as external
      // https://webpack.js.org/configuration/externals/
      return callback(null, importType + ' ' + request)
    }
    callback()
  }
}
