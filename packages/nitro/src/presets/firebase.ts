import { createRequire } from 'module'
import { join, relative, resolve } from 'pathe'
import fse from 'fs-extra'
import consola from 'consola'
import globby from 'globby'

import { readPackageJson, writeFile } from '../utils'
import { NitroPreset, NitroContext } from '../context'

export const firebase: NitroPreset = {
  entry: '{{ _internal.runtimeDir }}/entries/firebase',
  hooks: {
    async 'nitro:compiled' (ctx: NitroContext) {
      await writeRoutes(ctx)
    }
  }
}

async function writeRoutes ({ output: { publicDir, serverDir }, _nuxt: { rootDir } }: NitroContext) {
  if (!fse.existsSync(join(rootDir, 'firebase.json'))) {
    const firebase = {
      functions: {
        source: relative(rootDir, serverDir)
      },
      hosting: [
        {
          site: '<your_project_id>',
          public: relative(rootDir, publicDir),
          cleanUrls: true,
          rewrites: [
            {
              source: '**',
              function: 'server'
            }
          ]
        }
      ]
    }
    await writeFile(resolve(rootDir, 'firebase.json'), JSON.stringify(firebase))
  }

  const _require = createRequire(import.meta.url)

  const jsons = await globby(`${serverDir}/node_modules/**/package.json`)
  const prefixLength = `${serverDir}/node_modules/`.length
  const suffixLength = '/package.json'.length
  const dependencies = jsons.reduce((obj, packageJson) => {
    const dirname = packageJson.slice(prefixLength, -suffixLength)
    if (!dirname.includes('node_modules')) {
      obj[dirname] = _require(packageJson).version
    }
    return obj
  }, {} as Record<string, string>)

  let nodeVersion = '12'
  try {
    const currentNodeVersion = fse.readJSONSync(join(rootDir, 'package.json')).engines.node
    if (['12', '10'].includes(currentNodeVersion)) {
      nodeVersion = currentNodeVersion
    }
  } catch {}

  await writeFile(
    resolve(serverDir, 'package.json'),
    JSON.stringify(
      {
        private: true,
        main: './index.js',
        dependencies,
        devDependencies: {
          'firebase-functions-test': 'latest',
          'firebase-admin': readPackageJson('firebase-admin', _require).version,
          'firebase-functions': readPackageJson('firebase-functions', _require).version
        },
        engines: { node: nodeVersion }
      },
      null,
      2
    )
  )

  consola.success('Ready to run `firebase deploy`')
}
