
import {Pool, LDAPPool, LDAPPoolClient, IConnOpts} from 'ldap-pool';

let pool = new LDAPPool({
  size: 5,
  connOpts: {
    url: 'dog',
    reconnect: true
  },
  dn: 'foo',
  pwd: 'dog'
});


const c = pool.getClientSync();
console.log(c);
