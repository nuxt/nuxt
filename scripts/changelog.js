import consola from 'consola'
import execa from 'execa'
import groupBy from 'lodash/groupBy'
import sortBy from 'lodash/sortBy'
import { writeFile } from 'fs-extra'

const types = {
  fix: { title: 'Fixes' },
  feat: { title: 'Features' },
  hotfix: { title: 'HotFixes' },
  refactor: { title: 'Refactors' },
  perf: { title: 'Performance Improvements' },
  examples: { title: 'Examples' },
  chore: { title: 'Chore' },
  test: { title: 'Tests' }
}

const allowedTypes = Object.keys(types)

async function main() {
  // Get last git tag
  const lastGitTag = await getLastGitTag()

  // Get all commits from last release to current dev
  let commits = await getGitDiff(lastGitTag, 'dev')

  // Parse commits as conventional commits
  commits = parseCommits(commits)

  // Filter commits
  commits = commits.filter(c =>
    allowedTypes.includes(c.type) &&
    c.scope !== 'deps'
  )

  // Generate markdown
  const markdown = generateMarkDown(commits)

  process.stdout.write('\n\n' + markdown + '\n\n')
  await writeFile('CHANGELOG.md', markdown, 'utf-8')
}

function execCommand(cmd, args) {
  return execa(cmd, args).then(r => r.stdout)
}

async function getLastGitTag() {
  const r = await execCommand('git', ['describe'])
  return /^[^-]+/.exec(r)[0]
}

async function getGitDiff(from, to) {
  const r = await execCommand('git', ['--no-pager', 'log', `${from}...${to}`, '--pretty=%s|%h'])
  return r.split('\n').map((line) => {
    const [message, commit] = line.split('|')

    return { message, commit }
  })
}

function parseCommits(commits) {
  return commits.filter(c => c.message.includes(':')).map((commit) => {
    let [type, message] = commit.message.split(':')

    // Extract references from message
    const references = []
    const referencesRegex = /#[0-9]+/g
    let m
    while (m = referencesRegex.exec(message)) { // eslint-disable-line no-cond-assign
      references.push(m[0])
    }

    // Remove references and normalize
    message = message.replace(referencesRegex, '').replace(/\(\)/g, '').trim()

    // Extract scope from type
    let scope = type.match(/\((.*)\)/)
    if (scope) {
      scope = scope[1]
    }
    type = type.split('(')[0]

    return {
      message,
      type,
      scope,
      references,
      commit: commit.commit
    }
  })
}

function generateMarkDown(commits) {
  const commitGroups = groupBy(commits, 'type')

  let markdown = ''

  for (const type of allowedTypes) {
    const group = commitGroups[type]
    if (!group || !group.length) {
      continue
    }

    const { title } = types[type]
    markdown += '\n\n' + '## ' + title + '\n\n'
    markdown += sortBy(group, 'scope').map(formatCommitForMarkdown).join('\n')
  }

  return markdown.trim()
}

function formatCommitForMarkdown({ scope, type, message, references }) {
  let fMessage = scope ? `**${scope}**: ${message}` : message

  if (references.length) {
    fMessage += ' ' + references.map(r => `(${r})`).join(' ')
  }

  return '- ' + fMessage
}

main().catch(consola.error)
