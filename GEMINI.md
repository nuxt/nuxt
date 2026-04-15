<!-- crag:auto-start -->
# GEMINI.md

> Generated from governance.md by crag. Regenerate: `crag compile --target gemini`

## Project Context

- **Name:** nuxt-framework
- **Stack:** node, typescript, vue
- **Runtimes:** node

## Rules

### Quality Gates

Run these checks in order before committing any changes:

1. [lint] `npm run lint`
2. [test] `npm run test`
3. [build] `npm run build`
4. [build] `npm run typecheck`
5. [ci (inferred from workflow)] `pnpm build`
6. [ci (inferred from workflow)] `pnpm lint:docs:fix`
7. [ci (inferred from workflow)] `pnpm test:engines:fix`
8. [ci (inferred from workflow)] `pnpm test:runtime -u`
9. [ci (inferred from workflow)] `pnpm test:unit -u`
10. [ci (inferred from workflow)] `pnpm lint:fix`
11. [ci (inferred from workflow)] `pnpm test:types`
12. [ci (inferred from workflow)] `pnpm lint`

### Security

- No hardcoded secrets — grep for sk_live, AKIA, password= before commit

### Workflow

- Conventional commits (feat:, fix:, docs:, chore:, etc.)
- Commit trailer: Co-Authored-By: Claude <noreply@anthropic.com>
- Run quality gates before committing
- Review security implications of all changes

<!-- crag:auto-end -->
