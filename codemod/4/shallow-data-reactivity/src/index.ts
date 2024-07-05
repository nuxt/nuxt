import type { API, FileInfo, Options } from "jscodeshift";

export default function transform(
  file: FileInfo,
  api: API,
  options?: Options,
): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);

  // Helper function to preserve comments
  function replaceWithComments(path, newNode) {
    // If the original node had comments, add them to the new node
    if (path.node.comments) {
      newNode.comments = path.node.comments;
    }

    // Replace the node
    j(path).replaceWith(newNode);
  }

  // List of functions to modify
  const functionsToModify = [
    "useFetch",
    "useAsyncData",
    "useLazyAsyncData",
    "useLazyFetch",
  ];

  functionsToModify.forEach((funcName) => {
    // Find all calls to the function
    root
      .find(j.CallExpression, {
        callee: {
          type: "Identifier",
          name: funcName,
        },
      })
      .forEach((path) => {
        // Check if the second argument is missing
        if (path.node.arguments.length === 1) {
          // Add the second argument
          const newArg = j.objectExpression([
            j.property("init", j.identifier("deep"), j.literal(true)),
          ]);
          path.node.arguments.push(newArg);

          // Replace the node with the new node, preserving comments
          replaceWithComments(path, path.node);
        }
      });
  });

  root
    .find(j.CallExpression, {
      callee: {
        type: "Identifier",
        name: "useAsyncData",
      },
    })
    .forEach((path) => {
      const args = path.node.arguments;
      if (args[0].type === "ArrowFunctionExpression") {
        let slug = "";
        root
          .find(j.VariableDeclarator, {
            init: {
              type: "CallExpression",
              callee: {
                name: "useRoute",
              },
            },
          })
          .forEach((path) => {
            slug = path.node.id.name;
          });
        slug += ".params.slug";

        // Create the new arguments
        const newArg = j.identifier(slug);

        path.node.arguments.unshift(newArg);

        // Replace the node with the new node, preserving comments
        replaceWithComments(path, path.node);
      }
    });

  return root.toSource();
}
