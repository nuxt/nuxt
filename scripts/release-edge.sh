#!/bin/bash

set -xe

# Restore all git changes
git restore -s@ -SW  -- packages examples

TAG=${1:-latest}

# Bump versions to edge
pnpm jiti ./scripts/bump-edge

# Update token
if [[ ! -z ${NODE_AUTH_TOKEN} ]] ; then
  echo "//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}" >> ~/.npmrc
  echo "registry=https://registry.npmjs.org/" >> ~/.npmrc
  echo "always-auth=true" >> ~/.npmrc
  npm whoami
fi

# use absolute urls for better rendering on npm
sed -i.bak 's/\.\/\.github\/assets/https:\/\/github.com\/nuxt\/nuxt\/tree\/main\/\.github\/assets/g' README.md

# Release packages
for p in packages/* ; do
  if [[ $p == "packages/nuxi" ]] ; then
    continue
  fi
  if [[ $p == "packages/test-utils" ]] ; then
    continue
  fi
  if [[ $p == "packages/ui-templates" ]] ; then
    continue
  fi
  pushd $p
  echo "Publishing $p"
  cp ../../LICENSE .
  cp ../../README.md .
  pnpm publish --access public --no-git-checks --tag $TAG
  popd
done

mv README.md.bak README.md
