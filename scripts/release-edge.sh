#!/bin/bash

set -xe

# Restore all git changes
git restore -s@ -SW  -- packages examples docs

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

REPO_ROOT=$(pwd)

# Release packages
for PKG in packages/* docs ; do
  if [[ $PKG == "packages/nuxi" ]] ; then
    continue
  fi
  if [[ $PKG == "packages/test-utils" ]] ; then
    continue
  fi
  if [[ $PKG == "packages/ui-templates" ]] ; then
    continue
  fi
  pushd $PKG
  echo "Publishing $PKG"
  cp $REPO_ROOT/LICENSE .
  if [[ $PKG != "docs" ]]; then
    cp $REPO_ROOT/README.md .
  fi
  pnpm publish --access public --no-git-checks --tag $TAG
  popd
done

mv README.md.bak README.md
