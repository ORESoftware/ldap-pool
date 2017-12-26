#!/usr/bin/env bash


cd $(dirname "$0")
npm link;
npm link ldap-pool;


SUMAN=$(which suman);

if [[ -z ${SUMAN} ]]; then
npm install -g suman
fi

suman test/src/*