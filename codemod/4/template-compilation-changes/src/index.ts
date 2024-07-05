import type { API, FileInfo, Options } from "jscodeshift";

export default function transform(
  file: FileInfo,
  api: API,
  options?: Options,
): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);

  // Add the necessary import statements
  const importStatements = [
    j.importDeclaration(
      [j.importSpecifier(j.identifier("readFileSync"))],
      j.literal("node:fs"),
    ),
    j.importDeclaration(
      [j.importSpecifier(j.identifier("template"))],
      j.literal("lodash-es"),
    ),
  ];

  // Find and replace the `src` property within the `addTemplate` function call
  root
    .find(j.CallExpression, {
      callee: {
        type: "Identifier",
        name: "addTemplate",
      },
    })
    .forEach((path) => {
      const args = path.node.arguments;
      if (args.length == 1 && j.ObjectExpression.check(args[0])) {
        const properties = args[0].properties;
        const srcPropertyIndex = properties.findIndex(
          (prop) =>
            prop.type === "ObjectProperty" &&
            prop.key.type === "Identifier" &&
            prop.key.name === "src" &&
            prop.value.type === "CallExpression" &&
            prop.value.callee.type === "MemberExpression" &&
            prop.value.callee.object.type === "Identifier" &&
            prop.value.callee.object.name === "resolver" &&
            prop.value.callee.property.type === "Identifier" &&
            prop.value.callee.property.name === "resolve" &&
            prop.value.arguments.some(
              (arg) =>
                arg.type === "StringLiteral" &&
                (arg.value as string).endsWith(".ejs"),
            ),
        );
        if (srcPropertyIndex !== -1) {
          // find the value of the .ejs template path in the src
          const pathLiteral = properties[srcPropertyIndex].value.arguments.find(
            (arg: any) =>
              j.StringLiteral.check(arg) &&
              (arg.value as string).endsWith(".ejs"),
          ).value;

          // Remove the src property
          properties.splice(srcPropertyIndex, 1);

          // Add the getContents function
          properties.push(
            j.objectMethod(
              "method",
              j.identifier("getContents"),
              [
                j.objectPattern([
                  j.objectProperty(
                    j.identifier("options"),
                    j.identifier("options"),
                  ),
                ]),
              ],
              j.blockStatement([
                j.variableDeclaration("const", [
                  j.variableDeclarator(
                    j.identifier("contents"),
                    j.callExpression(j.identifier("readFileSync"), [
                      j.callExpression(
                        j.memberExpression(
                          j.identifier("resolver"),
                          j.identifier("resolve"),
                        ),
                        [j.literal(pathLiteral)],
                      ),
                      j.literal("utf-8"),
                    ]),
                  ),
                ]),
                j.returnStatement(
                  j.callExpression(
                    j.callExpression(j.identifier("template"), [
                      j.identifier("contents"),
                    ]),
                    [
                      j.objectExpression([
                        j.objectProperty(
                          j.identifier("options"),
                          j.identifier("options"),
                        ),
                      ]),
                    ],
                  ),
                ),
              ]),
            ),
          );

          // Add the import statements if they are not already present
          const existingImportDeclarations = root.find(j.ImportDeclaration);
          importStatements.forEach((importStatement) => {
            const isAlreadyImported =
              existingImportDeclarations.filter((path) => {
                return path.node.source.value === importStatement.source.value;
              }).length > 0;

            if (!isAlreadyImported) {
              root.get().node.program.body.unshift(importStatement);
            }
          });
        }
      }
    });

  return root.toSource();
}
