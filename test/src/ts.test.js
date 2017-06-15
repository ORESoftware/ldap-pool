"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ldap_pool_1 = require("ldap-pool");
var pool = new ldap_pool_1.ILDAPPool({
    size: 5,
    connOpts: {
        url: 'dog',
        reconnect: true
    },
    dn: 'foo',
    pwd: 'dog'
});
var c = pool.getClientSync();
console.log(c);
