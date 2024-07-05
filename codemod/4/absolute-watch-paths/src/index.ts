import type {
  API,
  ArrowFunctionExpression,
  FileInfo,
  Options,
} from "jscodeshift";

export default function transform(
  file: FileInfo,
  api: API,
  options?: Options,
): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);

  // Add the necessary import statements
  const importStatement = j.importDeclaration(
    [
      j.importSpecifier(j.identifier("relative")),
      j.importSpecifier(j.identifier("resolve")),
    ],
    j.literal("node:fs"),
  );

  const addImportIfNotExists = () => {
    const existingImport = root.find(j.ImportDeclaration, {
      source: { value: "node:fs" },
    });

    let hasRelative = false;
    let hasResolve = false;

    existingImport.forEach((path) => {
      path.node.specifiers!.forEach((specifier) => {
        if (specifier.type === "ImportSpecifier") {
          if (specifier.imported.name === "relative") {
            hasRelative = true;
          }
          if (specifier.imported.name === "resolve") {
            hasResolve = true;
          }
        }
      });
    });

    if (!hasRelative || !hasResolve) {
      if (existingImport.size() > 0) {
        existingImport.forEach((path) => {
          if (!hasRelative) {
            path.node.specifiers!.push(
              j.importSpecifier(j.identifier("relative")),
            );
          }
          if (!hasResolve) {
            path.node.specifiers!.push(
              j.importSpecifier(j.identifier("resolve")),
            );
          }
        });
      } else {
        root.get().node.program.body.unshift(importStatement);
      }
    }
  };

  // Find and modify the `nuxt.hook('builder:watch', async (event, path)` function
  root
    .find(j.CallExpression, {
      callee: {
        type: "MemberExpression",
        object: { name: "nuxt" },
        property: { name: "hook" },
      },
      arguments: [
        {
          type: "StringLiteral",
          value: "builder:watch",
        },
        {
          type: "ArrowFunctionExpression",
        },
      ],
    })
    .forEach((path) => {
      const arrowFunction = path.node.arguments[1] as ArrowFunctionExpression;
      if (arrowFunction.params.length === 2) {
        const pathParam = arrowFunction.params[1];
        if (j.Identifier.check(pathParam)) {
          // Add the import statement if necessary
          addImportIfNotExists();

          const relativeResolveStatement = j.expressionStatement(
            j.assignmentExpression(
              "=",
              j.identifier(pathParam.name),
              j.callExpression(j.identifier("relative"), [
                j.memberExpression(
                  j.memberExpression(
                    j.identifier("nuxt"),
                    j.identifier("options"),
                  ),
                  j.identifier("srcDir"),
                ),
                j.callExpression(j.identifier("resolve"), [
                  j.memberExpression(
                    j.memberExpression(
                      j.identifier("nuxt"),
                      j.identifier("options"),
                    ),
                    j.identifier("srcDir"),
                  ),
                  j.identifier(pathParam.name),
                ]),
              ]),
            ),
          );

          if (j.BlockStatement.check(arrowFunction.body)) {
            arrowFunction.body.body.unshift(relativeResolveStatement);
          } else {
            arrowFunction.body = j.blockStatement([
              relativeResolveStatement,
              j.returnStatement(arrowFunction.body),
            ]);
          }
        }
      }
    });

  return root.toSource(options);
}
