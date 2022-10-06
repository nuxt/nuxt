#!/bin/sh
set -e

cd ..
yarn install
cd packages/schema
yarn prepack --stub
