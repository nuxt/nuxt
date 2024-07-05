import type { API, FileInfo, Options } from "jscodeshift";

export default function transform(
  file: FileInfo,
  api: API,
  options?: Options,
): string | undefined {
  const j = api.jscodeshift;
  const root = j(file.source);

  const hooksToUpdate = ["useAsyncData", "useFetch"];

  // Helper function to update BinaryExpression nodes
  function updateBinaryExpression(node) {
    if (
      node.type === "BinaryExpression" &&
      node.operator === "===" &&
      node.left.type === "MemberExpression" &&
      node.left.property.type === "Identifier" &&
      node.left.property.name === "value" &&
      node.right.type === "Literal" &&
      node.right.value === null
    ) {
      const objectName = node.left.object.name;
      return j.binaryExpression("===", node.left, j.identifier("undefined"));
    }
    return node;
  }

  // Find all variable declarations that destructure error or data from useAsyncData & useFetch
  root
    .find(j.VariableDeclarator, {
      id: {
        type: "ObjectPattern",
        properties: (properties) =>
          properties.some(
            (prop) =>
              (prop.type === "Property" || prop.type === "ObjectProperty") &&
              prop.key.type === "Identifier" &&
              (prop.key.name === "error" || prop.key.name === "data"),
          ),
      },
      init: {
        callee: {
          type: "Identifier",
          name: (name) => hooksToUpdate.includes(name),
        },
      },
    })
    .forEach((path) => {
      if (path.node.id.type === "ObjectPattern") {
        const properties = path.node.id.properties;
        const errorProp = properties.find(
          (prop) =>
            (prop.type === "Property" || prop.type === "ObjectProperty") &&
            prop.key.type === "Identifier" &&
            prop.key.name === "error",
        );
        const dataProp = properties.find(
          (prop) =>
            (prop.type === "Property" || prop.type === "ObjectProperty") &&
            prop.key.type === "Identifier" &&
            prop.key.name === "data",
        );

        const propsToUpdate = [];
        if (errorProp) {
          propsToUpdate.push(errorProp.value.name);
        }
        if (dataProp) {
          propsToUpdate.push(dataProp.value.name);
        }

        // Update comparisons of prop.value === null to prop.value === undefined
        root
          .find(j.BinaryExpression, {
            left: {
              type: "MemberExpression",
              object: {
                type: "Identifier",
                name: (name) => propsToUpdate.includes(name),
              },
              property: {
                type: "Identifier",
                name: "value",
              },
            },
            right: {
              type: "NullLiteral",
              value: null,
            },
            operator: "===",
          })
          .forEach((path) => {
            const newNode = j.binaryExpression(
              "===",
              path.node.left,
              j.identifier("undefined"),
            );
            path.replace(newNode);
          });

        // Update ternary operators with prop.value === null
        root
          .find(j.ConditionalExpression, {
            test: {
              left: {
                type: "MemberExpression",
                object: {
                  type: "Identifier",
                  name: (name) => propsToUpdate.includes(name),
                },
                property: {
                  type: "Identifier",
                  name: "value",
                },
              },
              right: {
                type: "StringLiteral",
                value: null,
              },
              operator: "===",
            },
          })
          .forEach((path) => {
            path.node.test = updateBinaryExpression(path.node.test);
            if (path.node.consequent.type === "ConditionalExpression") {
              path.node.consequent.test = updateBinaryExpression(
                path.node.consequent.test,
              );
            } else {
              path.node.consequent = updateBinaryExpression(
                path.node.consequent,
              );
            }
            if (path.node.alternate.type === "ConditionalExpression") {
              path.node.alternate.test = updateBinaryExpression(
                path.node.alternate.test,
              );
            } else {
              path.node.alternate = updateBinaryExpression(path.node.alternate);
            }
          });
      }
    });

  return root.toSource();
}
