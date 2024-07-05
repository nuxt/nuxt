import type { Api } from "@codemod.com/workflow";

const nuxtConfigDirectoryPatterns = {
  rule: {
    any: [
      {
        pattern: {
          context: "{ srcDir: '' }",
          selector: "property_identifier",
          strictness: "relaxed",
        },
      },
      {
        pattern: {
          context: "{ serverDir: '' }",
          selector: "property_identifier",
          strictness: "relaxed",
        },
      },
      {
        pattern: {
          context: "{ appDir: '' }",
          selector: "property_identifier",
          strictness: "relaxed",
        },
      },
      {
        pattern: {
          context: "{ dir: {} }",
          selector: "property_identifier",
          strictness: "relaxed",
        },
      },
      { kind: "shorthand_property_identifier", regex: "^srcDir$" },
      { kind: "shorthand_property_identifier", regex: "^serverDir$" },
      { kind: "shorthand_property_identifier", regex: "^appDir$" },
      { kind: "shorthand_property_identifier", regex: "^dir$" },
    ],
  },
};

export async function workflow({ files, dirs, contexts }: Api) {
  // Check if the nuxt.config.js/ts file has custom directory structure
  const foundDirectoryPatterns = (
    await files("nuxt.config.{js,ts}")
      .jsFam()
      .astGrep(nuxtConfigDirectoryPatterns)
      .map(({ getNode }) => ({
        filename: contexts.getFileContext().file,
        text: getNode().text(),
        ignore:
          getNode().parent()?.parent()?.parent()?.kind() !==
          "property_identifier",
      }))
  ).filter(({ ignore }) => !ignore);
  if (foundDirectoryPatterns.length !== 0) {
    console.log(
      `Found ${
        foundDirectoryPatterns[0]?.filename ?? "nuxt.config.js/ts"
      } file with ${foundDirectoryPatterns.map(({ text }) => text).join(", ")} set. Skipping the migration.
  Automated migration is not supported for custom directory structure. Please migrate manually https://nuxt.com/docs/getting-started/upgrade.
        `,
    );
    return;
  }

  const appDirectory = (await dirs`app`.map(({ cwd }) => cwd())).pop();

  if (appDirectory) {
    // Move directories to the new structure
    await dirs`
        assets
        components
        composables
        layouts
        middleware
        pages
        plugins
        utils
      `.move(appDirectory);

    // Move files to the new structure
    await files`
        app.vue
        error.vue
        app.config.{js,ts}
      `.move(appDirectory);
  }
}
