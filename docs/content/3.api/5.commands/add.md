# `nuxi add`

Scaffold an entity into your Nuxt application.

```{bash}
npx nuxi add [--cwd] [--force] <TEMPLATE> <NAME>
```

Option        | Default          | Description
-------------------------|-----------------|------------------
`TEMPLATE` | - | Specify a template of the file to be generated.
`NAME` | - | Specify a name of the file that will be created.
`--cwd` | `.` | The directory of the target application.
`--force` | `false` | Force override file if it already exists.

**Example:**

```{bash}
npx nuxi add component TheHeader
```

The `add` command generates new elements:

* **component**: `npx nuxi add component TheHeader`
* **composable**: `npx nuxi add composable foo`
* **layout**: `npx nuxi add layout custom`
* **plugin**: `npx nuxi add plugin analytics`
* **page**: `npx nuxi add page about` or `npx nuxi add page "category/[id]"`
* **middleware**: `npx nuxi add middleware auth`
* **api**: `npx nuxi add api hello` (CLI will generate file under `/server/api`)
