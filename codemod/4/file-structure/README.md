Updates the file structure of a Nuxt.js project when migrating from v3 to v4.

This codemod will migrate to the new file structure introduced in Nuxt.js v4. The new file structure is more modular and allows for better organization of the project.

If you have any customizations related to the file structure, like `srcDir`, `serverDir`, `appDir`, `dir` -  you will need to revert them back to the default values.

This codemod will:
1. Move `assets`, `components`, `composables`, `layouts`, `middleware`, `pages`, `plugins`, `utils` directories to the `app` directory.
2. Move `app.vue`, `error.vue`, `app.config.ts` to the `app` directory.
3. Update relative imports in the project.
