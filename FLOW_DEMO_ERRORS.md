# Error Code Demos

> [!IMPORTANT]
> This shouldn't be read by the agent, that would be cheating

Each file triggers a specific build-time error. Run `pnpm dev` and check terminal output.

## Startup warnings (non-fatal)

### `app/plugins/1.meta-a.ts` — B2001
**Error:** `Invalid plugin metadata: the second argument to defineNuxtPlugin must be an object literal, but got CallExpression.`
**Fix:** Pass an object literal as the second argument instead of a function call.

### `app/plugins/2.meta-b.ts` — B2002
**Error:** `Invalid plugin metadata: spread elements and computed keys are not supported in plugin options.`
**Fix:** Replace spread syntax with static properties in the metadata object.

### `app/plugins/3.meta-c.ts` — B2003
**Error:** `Invalid plugin metadata: dependsOn must be an array of string literals.`
**Fix:** Use string literals in the `dependsOn` array (e.g. `['my-plugin']`).

### `app/components/MyButton.vue` + `app/components/my-button.vue` — B3011
**Error:** `Two component files resolving to the same name MyButton`
**Fix:** Rename one file or adjust `components.dirs` prefix in `nuxt.config`.

## Page transform errors (crash SSR)

### `app/pages/async-page.vue` — B4002
**Error:** `Await expressions are not supported in definePageMeta.`
**Fix:** Move the `await` outside of variables referenced in `definePageMeta`, or use a static value.

### `app/pages/settings.vue` — B4003
**Error:** `Multiple definePageMeta calls are not supported. Consolidate them into a single call.`
**Fix:** Merge both `definePageMeta()` calls into one.

## Module error (crashes startup)

### `modules/custom-template.ts` — B1003
**Error:** `Invalid template. Templates must have either src or getContents.`
**Fix:** Add a `getContents` function or `src` path to the `addTemplate()` call.
