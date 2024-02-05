import { execSync } from 'node:child_process'
import { promises as fsp } from 'node:fs'
import { $fetch } from 'ofetch'
import { resolve } from 'pathe'
import { globby } from 'globby'
import { execaSync } from 'execa'
import { determineSemverChange, getGitDiff, loadChangelogConfig, parseCommits } from 'changelogen'

export interface Dep {
  name: string,
  range: string,
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
        data[updated.type] = data[updated.type] || {}
        data[updated.type][updated.name] = updated.range
      }
    }
  }

  return {
    dir,
    data,
    save,
    updateDeps
  }
}

export async function loadWorkspace (dir: string) {
  const workspacePkg = await loadPackage(dir)
  const pkgDirs = (await globby(['packages/*'], { onlyDirectories: true })).sort()

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
    setVersion
  }
}

export async function determineBumpType () {
  const config = await loadChangelogConfig(process.cwd())
  const commits = await getLatestCommits()

  const bumpType = determineSemverChange(commits, config)

  return bumpType === 'major' ? 'minor' : bumpType
}

export async function getLatestCommits () {
  const config = await loadChangelogConfig(process.cwd())
  const latestTag = execaSync('git', ['describe', '--tags', '--abbrev=0']).stdout

  return parseCommits(await getGitDiff(latestTag), config)
}

export async function getContributors () {
  const contributors = [] as Array<{ name: string, username: string }>
  const emails = new Set<string>()
  const latestTag = execSync('git describe --tags --abbrev=0').toString().trim()
  const rawCommits = await getGitDiff(latestTag)
  for (const commit of rawCommits) {
    if (emails.has(commit.author.email) || commit.author.name === 'renovate[bot]') { continue }
    const { author } = await $fetch<{ author: { login: string, email: string }}>(`https://api.github.com/repos/nuxt/nuxt/commits/${commit.shortHash}`, {
      headers: {
        'User-Agent': 'nuxt/nuxt',
        Accept: 'application/vnd.github.v3+json',
        Authorization: `token ${process.env.GITHUB_TOKEN}`
      }
    })
    if (!contributors.some(c => c.username === author.login)) {
      contributors.push({ name: commit.author.name, username: author.login })
    }
    emails.add(author.email)
  }
  return contributors
}
