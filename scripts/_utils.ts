import { execFileSync } from 'node:child_process'
import { promises as fsp } from 'node:fs'
import { resolve } from 'pathe'
import { glob } from 'tinyglobby'
import { exec } from 'tinyexec'

export interface Dep {
  name: string
  range: string
  type: string
}

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T
export type Package = ThenArg<ReturnType<typeof loadPackage>>

export async function loadPackage (dir: string) {
  const pkgPath = resolve(dir, 'package.json')
  const data = JSON.parse(await fsp.readFile(pkgPath, 'utf-8').catch(() => '{}'))
  const save = () => fsp.writeFile(pkgPath, JSON.stringify(data, null, 2) + '\n')

  const updateDeps = (reviver: (dep: Dep) => Dep | void) => {
    for (const type of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      if (!data[type]) { continue }
      for (const e of Object.entries(data[type])) {
        const dep: Dep = { name: e[0], range: e[1] as string, type }
        delete data[type][dep.name]
        const updated = reviver(dep) || dep
        data[updated.type] ||= {}
        data[updated.type][updated.name] = updated.range
      }
    }
  }

  return {
    dir,
    data,
    save,
    updateDeps,
  }
}

export async function loadWorkspace (dir: string) {
  const workspacePkg = await loadPackage(dir)
  const pkgDirs = (await glob(['packages/*', 'docs'], { onlyDirectories: true })).sort()

  const packages: Package[] = []

  for (const pkgDir of pkgDirs) {
    const pkg = await loadPackage(pkgDir)
    if (!pkg.data.name) { continue }
    packages.push(pkg)
  }

  const find = (name: string) => {
    const pkg = packages.find(pkg => pkg.data.name === name)
    if (!pkg) {
      throw new Error('Workspace package not found: ' + name)
    }
    return pkg
  }

  const rename = (from: string, to: string) => {
    find(from).data._name = find(from).data.name
    find(from).data.name = to
    for (const pkg of packages) {
      pkg.updateDeps((dep) => {
        if (dep.name === from && !dep.range.startsWith('npm:')) {
          dep.range = 'npm:' + to + '@' + dep.range
        }
      })
    }
  }

  const setVersion = (name: string, newVersion: string, opts: { updateDeps?: boolean } = {}) => {
    find(name).data.version = newVersion
    if (!opts.updateDeps) { return }

    for (const pkg of packages) {
      pkg.updateDeps((dep) => {
        if (dep.name === name) {
          dep.range = newVersion
        }
      })
    }
  }

  const save = () => Promise.all(packages.map(pkg => pkg.save()))

  return {
    dir,
    workspacePkg,
    packages,
    save,
    find,
    rename,
    setVersion,
  }
}

export async function getLatestTag () {
  const { stdout: latestTag } = await exec('git', ['describe', '--tags', '--abbrev=0'])
  return latestTag.trim()
}

/**
 * The largest semver change implied by conventional commits since the latest tag,
 * or `null` if no commit implies a `minor` or `major` bump.
 */
export async function determineBumpType (since?: string): Promise<'major' | 'minor' | null> {
  const args = ['log', `${await getLatestTag()}..HEAD`, '--pretty=format:%s%n%b%x00']
  if (since) {
    args.push('--since', since)
  }
  const log = execFileSync('git', args, { encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 })

  let bumpType: 'minor' | null = null
  for (const commit of log.split('\0')) {
    const [subject = '', ...body] = commit.trim().split('\n')
    if (/^\w+(?:\([^)]*\))?!:/.test(subject) || body.some(line => line.startsWith('BREAKING CHANGE'))) {
      return 'major'
    }
    if (/^feat(?:\([^)]*\))?:/.test(subject)) {
      bumpType = 'minor'
    }
  }
  return bumpType
}
