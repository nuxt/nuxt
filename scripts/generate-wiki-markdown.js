#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const https = require('https')

const repoPath = 'nuxt/nuxt.js'
const pkgNamespace = '@nuxt'
const branches = [
  {
    name: '2.x',
    title: 'Stable'
  },
  {
    name: '',
    title: 'Edge',
    pkgSuffix: '-edge'
  }
]

const template = ({ tables, vars, extra }) => `
<!-- /* this page is automatically generate */ -->

## Distributions
${tables.dist}

## Core packages
${tables.pkgs}

${extra}
${vars}
`

const options = {
  '-d': 'dependencies',
  '-p': 'packageSize'
}

const optionKey = process.argv.find(arg => !!options[arg])

if (!optionKey) {
  // eslint-disable-next-line no-console
  console.log(`Usage: ${path.basename(__filename)} -d | -p
  -d    Generate markdown for dependencies page
  -p    Generate markdown for package sizes page
`)
  process.exit(1)
}

const generateOption = options[optionKey]

function arrayToTable (tableArray) {
  let table = ''
  tableArray.forEach((row, index) => {
    table += row.join('|')
    table += '\n'

    if (!index) {
      // header border
      table += row.map(c => '-').join('|')
      table += '\n'
    }
  })

  return table
}

function request (url) {
  return new Promise((resolve, reject) => {
    https.get(url, (resp) => {
      let data = ''

      // A chunk of data has been recieved.
      resp.on('data', (chunk) => {
        data += chunk
      })

      // The whole response has been received. Print out the result.
      resp.on('end', () => resolve(data))
    }).on('error', (err) => {
      reject(err)
    })
  })
}

function createPackageSizeBadge ({ branch: { name: branch, pkgSuffix }, name, fullName, type, vars }) {
  fullName = `${fullName}${pkgSuffix || ''}`

  const imageKey = `${fullName}-phobia-${branch}`
  const linkKey = `${fullName}-phobia-${branch}-href`

  vars[imageKey] = `https://flat.badgen.net/packagephobia/install/${fullName}`
  vars[linkKey] = `https://packagephobia.now.sh/result?p=${fullName}`

  return `[![${imageKey}][${imageKey}]][${linkKey}]`
}

function createDependencyBadge ({ branch: { name: branch }, name, fullName, type, vars }) {
  const branchPath = branch ? `/${branch}` : ''

  const imageKey = `{fullName}-david-${branch}`
  const linkKey = `${fullName}-david-${branch}-href`

  vars[imageKey] = `https://david-dm.org/${repoPath}${branchPath}/status.svg?style=flat-square&path=${type}%2F${name}`
  vars[linkKey] = `https://david-dm.org/${repoPath}${branchPath}?path=${type}%2F${name}`

  return `[![${imageKey}][${imageKey}]][${linkKey}]`
}

function requestDependencies (branch, name, type) {
  const branchPath = branch ? `/${branch}` : ''

  const url = `https://david-dm.org/${repoPath}${branchPath}/project.json?path=${type}%2F${name}`
  return request(url)
}

async function getExternalDependenciesTable ({ distributions, packages }, vars) {
  const dependencies = {
    dist: {},
    pkgs: {}
  }

  for (const name of distributions) {
    // only check the first / stable branch
    const deps = await requestDependencies(branches[0].name, name, 'distributions')
    dependencies.dist[name] = JSON.parse(deps).dependencies

    Object.keys(dependencies.dist[name]).map(depName => (dependencies.dist[name][depName] = name))
  }

  for (const name of packages) {
    const fullName = `${pkgNamespace}/${name}`
    const deps = await requestDependencies(branches[0].name, name, 'packages')
    dependencies.pkgs[fullName] = JSON.parse(deps).dependencies
  }

  const distNames = Object.keys(dependencies.dist)
  const pkgNames = Object.keys(dependencies.pkgs)
  const allDependencies = []

  // find all repo pkgs used per dist
  for (const distName of distNames) {
    const seenPkgs = []
    const repoPkgs = Object.keys(dependencies.dist[distName]).filter(name => name.startsWith(`${pkgNamespace}/`) && pkgNames.includes(name))

    while (repoPkgs.length) {
      const repoPkg = repoPkgs.shift()

      seenPkgs.push(repoPkg)
      repoPkgs.push(...Object.keys(dependencies.pkgs[repoPkg]).filter(name => name.startsWith(`${pkgNamespace}/`) && pkgNames.includes(name) && !seenPkgs.includes(name)))
    }

    for (const repoPkg of seenPkgs) {
      Object.keys(dependencies.pkgs[repoPkg]).forEach(name => (dependencies.pkgs[repoPkg][name] = repoPkg))

      dependencies.dist[distName] = {
        ...dependencies.pkgs[repoPkg],
        ...dependencies.dist[distName]
      }
    }

    allDependencies.push(...Object.keys(dependencies.dist[distName]).filter(name => !pkgNames.includes(name)))
  }

  // create a table with each unique dependency as row and its version per dist
  const table = [['Dependency', ...distNames]]
  allDependencies.sort()
  allDependencies
    // remove duplicate entries
    // this assumes that within the monorepo all packages use the same version
    // this script is not meant for validating your deps => use renovate or similar
    .filter((depName, index, arr) => index === arr.findIndex(name => name === depName))
    .forEach((depName) => {
      const npmKey = `${depName}-npm`
      vars[npmKey] = `https://www.npmjs.com/package/${depName}`

      const createShield = (distName) => {
        const shieldKey = `${depName}-${distName}-shield`
        vars[shieldKey] = `https://img.shields.io/npm/dependency-version/${dependencies.dist[distName][depName]}/${depName}?style=flat-square`
        return `![${shieldKey}][${shieldKey}]`
      }

      table.push([`[${depName}][${npmKey}]`, ...distNames.map(distName => dependencies.dist[distName][depName] ? createShield(distName) : '')])
    })

  return table
}

function createBadgeTable (type, entries, vars) {
  const table = [['Package', ...Object.values(branches).map(b => b.title)]]

  for (const name of entries) {
    const fullName = type === 'distributions' ? name : `${pkgNamespace}/${name}`
    const linkKey = `${fullName}-href`
    vars[linkKey] = `https://www.npmjs.com/package/${fullName}`

    const row = [`[${fullName}][${linkKey}]`]

    for (const branch of branches) {
      let badge
      if (generateOption === 'dependencies') {
        badge = createDependencyBadge({ branch, name, fullName, type, vars })
      } else {
        badge = createPackageSizeBadge({ branch, name, fullName, type, vars })
      }

      row.push(badge)
    }
    table.push(row)
  }

  return table
}

async function main () {
  const distPath = path.join(__dirname, '..', 'distributions')
  const pkgsPath = path.join(__dirname, '..', 'packages')

  const distributions = fs.readdirSync(distPath)
  const packages = fs.readdirSync(pkgsPath)

  const vars = {}
  const tables = {
    dist: arrayToTable(createBadgeTable('distributions', distributions, vars)),
    pkgs: arrayToTable(createBadgeTable('packages', packages, vars))
  }

  let extra = ''
  if (generateOption === 'dependencies') {
    extra = `
## External dependencies
(aggregated from core packages within the monorepo)
${arrayToTable(await getExternalDependenciesTable({ distributions, packages }, vars))}
`
  }

  const md = template({
    tables,
    extra,
    vars: Object.entries(vars).reduce((acc, [key, value]) => `${acc}[${key}]: ${value}\n`, '')
  })

  // eslint-disable-next-line no-console
  console.log(md)
}

// eslint-disable-next-line no-console
main().catch(err => console.error(err))
