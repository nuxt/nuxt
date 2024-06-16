#!/bin/bash

set -e

# Restore all git changes
git restore -s@ -SW  -- packages examples

# Build all once to ensure things are nice
pnpm build

# use absolute urls for better rendering on npm
sed -i '' 's/\.\/\.github\/assets/https:\/\/github.com\/nuxt\/nuxt\/tree\/main\/\.github\/assets/g' README.md

# Release packages
for PKG in packages/* ; do
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
  TAG="latest"
  echo "⚡ Publishing $PKG with tag $TAG"
  cp ../../LICENSE .
  cp ../../README.md .
  pnpm publish --access public --no-git-checks --tag $TAG
  popd > /dev/null
done
