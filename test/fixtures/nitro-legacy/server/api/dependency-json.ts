import pkg from 'typescript/package.json'

export default defineEventHandler(() => ({ name: pkg.name }))
