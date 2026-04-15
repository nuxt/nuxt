<!-- crag:auto-start -->
# AGENTS.md

> Generated from governance.md by crag. Regenerate: `crag compile --target agents-md`

## Project: nuxt-framework


## Quality Gates

All changes must pass these checks before commit:

### Lint
1. `npm run lint`

### Test
1. `npm run test`

### Build
1. `npm run build`
2. `npm run typecheck`

### Ci (inferred from workflow)
1. `pnpm build`
2. `pnpm lint:docs:fix`
3. `pnpm test:engines:fix`
4. `pnpm test:runtime -u`
5. `pnpm test:unit -u`
6. `pnpm lint:fix`
7. `pnpm test:types`
8. `pnpm lint`

## Coding Standards

- Stack: node, typescript, vue
- Conventional commits (feat:, fix:, docs:, etc.)
- Commit trailer: Co-Authored-By: Claude <noreply@anthropic.com>

## Architecture

- Type: microservices
- Services: kit, nitro-server, nuxt, rspack, schema, ui-templates, vite, webpack

## Key Directories

- `.github/` — CI/CD
- `docs/` — documentation
- `packages/` — workspace packages
- `scripts/` — tooling
- `test/` — tests

## Testing

- Framework: vitest
- Layout: structured + e2e
- Naming: *.test.{js,ts}
- Coverage: configured

## Code Style

- Indent: 2 spaces
- Linter: eslint

## Anti-Patterns

Do not:
- Do not leave `console.log` in production code — use a proper logger
- Do not use synchronous filesystem APIs in request handlers
- Do not use `any` type — use `unknown` or proper types instead
- Do not use `@ts-ignore` — fix the type error or use `@ts-expect-error` with a reason
- Prefer `as const` over `enum` for string unions

## Framework Conventions

- Vue 3.5.30
- Use Composition API with <script setup> — avoid Options API in new code

## Security

- No hardcoded secrets — grep for sk_live, AKIA, password= before commit

## Workflow

1. Read `governance.md` at the start of every session — it is the single source of truth.
2. Run all mandatory quality gates before committing.
3. If a gate fails, fix the issue and re-run only the failed gate.
4. Use the project commit conventions for all changes.

<!-- crag:auto-end -->
