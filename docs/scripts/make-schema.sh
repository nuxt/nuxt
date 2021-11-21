#!/bin/sh
set -e

cd ..
yarn="node `pwd`/.yarn/releases/yarn-*.cjs"
$yarn install
cd packages/schema
$yarn prepack --stub
