#!/usr/bin/env bash

cd $(dirname "$0")
rm -rf docs
typedoc --mode modules --out docs .
