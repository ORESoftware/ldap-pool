#!/usr/bin/env bash


cd $(dirname "$0")
npm link;
npm link ldap-pool;
./node_modules/.bin/suman test/src/*