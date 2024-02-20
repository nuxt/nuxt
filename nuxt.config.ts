// For pnpm typecheck:docs to generate correct types
export default defineNuxtConfig({
  pages: process.env.DOCS_TYPECHECK === 'true'
})
