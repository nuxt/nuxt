import { execSync } from 'node:child_process';
import { promises as fsp } from 'node:fs';
import { $fetch } from 'ofetch';
import { resolve } from 'pathe';
import { globby } from 'globby';
import { execaSync } from 'execa';
import { determineSemverChange, getGitDiff, loadChangelogConfig, parseCommits } from 'changelogen';

export interface Dep {
  name: string;
  range: string;
  type: string;
}

type ThenArg<T> = T extends PromiseLike<infer U> ? U : T;
export type Package = ThenArg<ReturnType<typeof loadPackage>>;

/**
 * Load a package.json file and provide utility functions for updating dependencies and saving changes.
 * @param {string} dir - Directory of the package.json file.
 * @returns {Promise<Package>} - Loaded package with utility functions.
 */
export async function loadPackage(dir: string) {
  const pkgPath = resolve(dir, 'package.json');
  const data = JSON.parse(await fsp.readFile(pkgPath, 'utf-8').catch(() => '{}'));
  const save = () => fsp.writeFile(pkgPath, JSON.stringify(data, null, 2) + '\n');

  const updateDeps = (reviver: (dep: Dep) => Dep | void) => {
    for (const type of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      if (!data[type]) continue;
      for (const [name, range] of Object.entries(data[type])) {
        const dep: Dep = { name, range: range as string, type };
        delete data[type][dep.name];
        const updated = reviver(dep) || dep;
        data[updated.type] = data[updated.type] || {};
        data[updated.type][updated.name] = updated.range;
      }
    }
  };

  return {
    dir,
    data,
    save,
    updateDeps,
  };
}

/**
 * Load the workspace and its packages.
 * @param {string} dir - Directory of the workspace.
 * @returns {Promise<{workspacePkg: Package, packages: Package[], save: () => Promise<void>, find: (name: string) => Package, rename: (from: string, to: string) => void, setVersion: (name: string, newVersion: string, opts?: { updateDeps?: boolean }) => void}>} - Loaded workspace with utility functions.
 */
export async function loadWorkspace(dir: string) {
  const workspacePkg = await loadPackage(dir);
  const pkgDirs = (await globby(['packages/*'], { onlyDirectories: true })).sort();

  const packages: Package[] = [];

  for (const pkgDir of pkgDirs) {
    const pkg = await loadPackage(pkgDir);
    if (!pkg.data.name) continue;
    packages.push(pkg);
  }

  const find = (name: string) => {
    const pkg = packages.find(pkg => pkg.data.name === name);
    if (!pkg) {
      throw new Error('Workspace package not found: ' + name);
    }
    return pkg;
  };

  const rename = (from: string, to: string) => {
    const pkg = find(from);
    pkg.data._name = pkg.data.name;
    pkg.data.name = to;
    for (const pkg of packages) {
      pkg.updateDeps((dep) => {
        if (dep.name === from && !dep.range.startsWith('npm:')) {
          dep.range = 'npm:' + to + '@' + dep.range;
        }
      });
    }
  };

  const setVersion = (name: string, newVersion: string, opts: { updateDeps?: boolean } = {}) => {
    find(name).data.version = newVersion;
    if (!opts.updateDeps) return;

    for (const pkg of packages) {
      pkg.updateDeps((dep) => {
        if (dep.name === name) {
          dep.range = newVersion;
        }
      });
    }
  };

  const save = () => Promise.all(packages.map(pkg => pkg.save()));

  return {
    dir,
    workspacePkg,
    packages,
    save,
    find,
    rename,
    setVersion,
  };
}

/**
 * Determine the type of version bump needed based on the latest commits.
 * @returns {Promise<string>} - Type of version bump.
 */
export async function determineBumpType() {
  const config = await loadChangelogConfig(process.cwd());
  const commits = await getLatestCommits();
  return determineSemverChange(commits, config);
}

/**
 * Get the latest commits from the repository.
 * @returns {Promise<any[]>} - Parsed commits.
 */
export async function getLatestCommits() {
  const config = await loadChangelogConfig(process.cwd());
  const latestTag = execaSync('git', ['describe', '--tags', '--abbrev=0']).stdout.trim();
  return parseCommits(await getGitDiff(latestTag), config);
}

/**
 * Get the list of contributors since the latest tag.
 * @returns {Promise<{ name: string, username: string }[]>} - List of contributors.
 */
export async function getContributors() {
  const contributors: Array<{ name: string, username: string }> = [];
  const emails = new Set<string>();
  const latestTag = execSync('git describe --tags --abbrev=0').toString().trim();
  const rawCommits = await getGitDiff(latestTag);
  for (const commit of rawCommits) {
    if (emails.has(commit.author.email) || commit.author.name === 'renovate[bot]') continue;
    const { author } = await $fetch<{ author: { login: string, email: string } }>(`https://api.github.com/repos/nuxt/nuxt/commits/${commit.shortHash}`, {
      headers: {
        'User-Agent': 'nuxt/nuxt',
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
      },
    });
    if (!contributors.some(c => c.username === author.login)) {
      contributors.push({ name: commit.author.name, username: author.login });
    }
    emails.add(author.email);
  }
  return contributors;
}
