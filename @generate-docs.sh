#!/usr/bin/env bash

cd $(dirname "$0")
rm -rf docs
typedoc --excludePrivate --ignoreCompilerErrors --mode file --theme minimal --out docs .
