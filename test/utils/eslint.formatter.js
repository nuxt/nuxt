/**
 * Based on Stylish reporter by Sindre Sorhus
 *
 * @author pimlie
 *
 * Given the fileMatchPattern, this formatter combines all results for the
 * matched files into a single result. It adds occurences to each file and each
 * file message and list them in the table.
 * You can filter with messages to show based on the ratio of a message
 * occurence to the total occurence of the file
 */
'use strict'

// ------------------------------------------------------------------------------
// Config
// ------------------------------------------------------------------------------

const fileMatchPattern = /.*?\/test\/fixtures\/[^/]+\/.nuxt[^/]*\/(?:.build\/)?(.*?)$/
const defaultThreshold = 0.6

// ------------------------------------------------------------------------------
// ENV Options
// ------------------------------------------------------------------------------

// Message is dimmed when it occurres less than this factor of file occurences
const occurenceThreshold = process.env.ESLINT_THRESHOLD || defaultThreshold

// Dont print messages if they are below threshold
const hideBelowThreshold = process.env.ESLINT_ONLYTHRES !== undefined

const showSource = process.env.ESLINT_SHOWSRC !== undefined

// ------------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------------

/**
 * Given a word and a count, append an s if count is not one.
 * @param {string} word A word in its singular form.
 * @param {int} count A number controlling whether word should be pluralized.
 * @returns {string} The original word with an s on the end if count is not one.
 */
function pluralize(word, count) {
  return (count === 1 ? word : `${word}s`)
}

// ------------------------------------------------------------------------------
// Public Interface
// ------------------------------------------------------------------------------
const fs = require('fs')
const chalk = require('chalk')
const stripAnsi = require('strip-ansi')
const table = require('text-table')
const { find, indexOf, sortBy } = require('lodash')

module.exports = function (results) {
  const merged = {}

  results.forEach((result) => {
    const filePath = result.filePath.match(fileMatchPattern)[1]

    if (typeof merged[filePath] === 'undefined') {
      merged[filePath] = {
        filePath,
        occurence: 1,
        messages: []
      }
    } else {
      merged[filePath].occurence++
    }

    result.messages.forEach((message) => {
      const existingMessage = find(merged[filePath].messages, (m) => {
        return m.ruleId === message.ruleId &&
          m.severity === message.severity &&
          m.line === message.line &&
          m.column === message.column &&
          (!message.endLine || m.endLine === message.endLine) &&
          (!message.endColumn || m.endColumn === message.endColumn)
      })

      if (typeof existingMessage !== 'undefined') {
        const index = indexOf(merged[filePath].messages, existingMessage)
        merged[filePath].messages[index].occurence++
      } else {
        message.occurence = 1
        message.sourceFile = result.filePath
        merged[filePath].messages.push(message)
      }
    })
  })

  if (occurenceThreshold >= 1) {
    Object.keys(merged).forEach((filePath) => {
      merged[filePath].messages = merged[filePath]
        .messages
        .filter(message => message.occurence === merged[filePath].occurence)
    })
  }

  results = Object.keys(merged).map((filePath) => {
    const { messages, occurence } = merged[filePath]

    let errorCount = 0
    let warningCount = 0
    let fixableErrorCount = 0
    let fixableWarningCount = 0

    messages.forEach((message) => {
      if (message.severity === 1) {
        warningCount++

        if (typeof message.fix !== 'undefined') {
          fixableWarningCount++
        }
      } else if (message.severity === 2) {
        errorCount++

        if (typeof message.fix !== 'undefined') {
          fixableErrorCount++
        }
      }
    })

    return {
      filePath,
      occurence,
      messages: sortBy(messages, ['line', 'column', 'occurence']),
      errorCount,
      warningCount,
      fixableErrorCount,
      fixableWarningCount
    }
  })

  let output = '\n'
  let errorCount = 0
  let warningCount = 0
  let fixableErrorCount = 0
  let fixableWarningCount = 0
  let summaryColor = 'yellow'

  const fileCache = {}
  results.forEach((result) => {
    const messages = result.messages

    if (messages.length === 0) {
      return
    }

    errorCount += result.errorCount
    warningCount += result.warningCount
    fixableErrorCount += result.fixableErrorCount
    fixableWarningCount += result.fixableWarningCount

    output += `${chalk.underline(result.filePath)} (${result.occurence}x)\n`

    let fileTable = `${table(
      messages
        .filter(message => !hideBelowThreshold || message.occurence >= occurenceThreshold * result.occurence)
        .map((message) => {
          const isBelowThreshold = message.occurence < occurenceThreshold * result.occurence

          let messageType
          if (message.fatal || message.severity === 2) {
            messageType = chalk.red('error')
            summaryColor = 'red'
          } else {
            messageType = chalk.yellow('warning')
          }

          let messageText = message.message.replace(/([^ ])\.$/, '$1')
          let messageOccurence = message.occurence + 'x'

          if (isBelowThreshold) {
            messageType = chalk.dim(messageType)
            messageText = chalk.dim(messageText)
            messageOccurence = chalk.dim(messageOccurence)
          }

          return [
            '',
            message.line || 0,
            message.column || 0,
            messageOccurence,
            messageType,
            messageText,
            chalk.dim(message.ruleId || '')
          ]
        }),
      {
        align: ['', 'r', 'l'],
        stringLength(str) {
          return stripAnsi(str).length
        }
      }
    ).split('\n').map(el => el.replace(/(\d+)\s+(\d+)/, (m, p1, p2) => chalk.dim(`${p1}:${p2}`))).join('\n')}\n\n`

    if (!showSource) {
      output += fileTable
    } else {
      fileTable = fileTable.split('\n')

      messages
        .filter(message => !hideBelowThreshold || message.occurence >= occurenceThreshold * result.occurence)
        .map((message, index) => {
          output += fileTable[index] + '\n'

          if (message.sourceFile && message.line) {
            if (!fileCache[message.sourceFile]) {
              fileCache[message.sourceFile] = fs.readFileSync(message.sourceFile, 'utf8').split('\n')
            }

            output += '\n'
            output += chalk.bgBlackBright(chalk.dim(fileCache[message.sourceFile].slice(message.line - 2, message.line + 1)
              .map((line, index) => {
                const l = `${message.line - 1 + index}: ${line}`
                return l + ' '.repeat(Math.max(0, 80 - l.length))
              })
              .join('\n')))
            output += '\n\n'
          }
        })

      output += '\n'
    }
  })

  const total = errorCount + warningCount

  if (total > 0) {
    output += chalk[summaryColor].bold([
      '\u2716 ', total, pluralize(' problem', total),
      ' (', errorCount, pluralize(' error', errorCount), ', ',
      warningCount, pluralize(' warning', warningCount), ')\n'
    ].join(''))

    if (fixableErrorCount > 0 || fixableWarningCount > 0) {
      output += chalk[summaryColor].bold([
        '  ', fixableErrorCount, pluralize(' error', fixableErrorCount), ' and ',
        fixableWarningCount, pluralize(' warning', fixableWarningCount),
        ' potentially fixable with the `--fix` option.\n'
      ].join(''))
    }
  }

  return total > 0 ? output : ''
}
