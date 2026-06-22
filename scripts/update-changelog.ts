import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { $fetch } from 'ofetch'
import { inc } from 'semver'
import { generateMarkDown, getCurrentGitBranch, loadChangelogConfig } from 'changelogen'
import { consola } from 'consola'
import { determineBumpType, getContributors, getLatestCommits, getLatestReleasedTag, getLatestTag, getPreviousReleasedCommits, loadWorkspace } from './_utils.ts'

const handleSeparateBranch = false

async function main () {
  const releaseBranch = getCurrentGitBranch()
  const workspace = await loadWorkspace(process.cwd())
  const config = await loadChangelogConfig(process.cwd(), {})

  const prevMessages = new Set(handleSeparateBranch ? await getPreviousReleasedCommits().then(r => r.map(c => c.message)) : [])

  // TODO: revert after release of v4.2.0
  // Get the date of the latest tag to filter out merged history commits
  const latestTagName = await getLatestTag()
  const tagDate = execFileSync('git', ['log', '-1', '--format=%ai', latestTagName], { encoding: 'utf-8' })
  const sinceDate = tagDate.trim()

  const commits = await getLatestCommits(sinceDate).then(commits => commits.filter(
    c => config.types[c.type] && !(c.type === 'chore' && c.scope === 'deps') && !prevMessages.has(c.message),
  ))
  const bumpType = await determineBumpType(sinceDate) || 'patch'

  const newVersion = inc(workspace.find('nuxt').data.version, bumpType)
  const changelog = await generateMarkDown(commits, config)

  // Create and push a branch with bumped versions if it has not already been created
  const branchExists = execFileSync('git', ['ls-remote', '--heads', 'origin', `v${newVersion}`], { encoding: 'utf-8' }).trim().length > 0
  if (!branchExists) {
    execFileSync('git', ['config', '--global', 'user.email', 'daniel@roe.dev'])
    execFileSync('git', ['config', '--global', 'user.name', 'Daniel Roe'])
    execFileSync('git', ['checkout', '-b', `v${newVersion}`])

    for (const pkg of workspace.packages.filter(p => !p.data.private)) {
      workspace.setVersion(pkg.data.name, newVersion!)
    }
    await workspace.save()

    execFileSync('git', ['commit', '-am', `v${newVersion}`])
    execFileSync('git', ['push', '-u', 'origin', `v${newVersion}`])
  }

  // Get the current PR for this release, if it exists
  const [currentPR] = await $fetch(`https://api.github.com/repos/nuxt/nuxt/pulls?head=nuxt:v${newVersion}`)
  const contributors = await getContributors(sinceDate)

  const latestTag = latestTagName
  const previousReleasedTag = handleSeparateBranch ? await getLatestReleasedTag() : latestTag

  const releaseNotes = [
    currentPR?.body.replace(/## 👉 Changelog[\s\S]*$/, '') || `> ${newVersion} is the next ${bumpType} release.\n>\n> **Timetable**: to be announced.`,
    '## 👉 Changelog',
    changelog
      .replace(/^## v.*\n/, '')
      .replace(`...${releaseBranch}`, `...v${newVersion}`)
      .replace(/### ❤️ Contributors[\s\S]*$/, '')
      .replace(/[\n\r]+/g, '\n')
      .replace(latestTag, previousReleasedTag),
    '### ❤️ Contributors',
    contributors.map(c => `- ${c.name} (@${c.username})`).join('\n'),
  ].join('\n')

  // Create a PR with release notes if none exists
  if (!currentPR) {
    return await $fetch('https://api.github.com/repos/nuxt/nuxt/pulls', {
      method: 'POST',
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
      },
      body: {
        title: `v${newVersion}`,
        head: `v${newVersion}`,
        base: releaseBranch,
        body: releaseNotes,
        draft: true,
      },
    })
  }

  // Update release notes if the pull request does exist
  await $fetch(`https://api.github.com/repos/nuxt/nuxt/pulls/${currentPR.number}`, {
    method: 'PATCH',
    headers: {
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
    },
    body: {
      body: releaseNotes,
    },
  })
}

main().catch((err) => {
  consola.error(err)
  process.exit(1)
})
