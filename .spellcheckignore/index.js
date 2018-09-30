const { join } = require('path')
const { readFileSync } = require('fs')
const text = readFileSync(join(__dirname, 'cache.tsv'), 'utf8')
const skipWords = text.split('\n')
module.exports = skipWords
