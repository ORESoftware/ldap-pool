

# LDAP Pool - a simple client pool for LDAP connections

## This API is promise-based - so as to work well with async/await flow control.



## Usage

```javascript

let LDAPPool = require('ldap-pool');

let pool = new LDAPPool({


});


// synchronous
let client = pool.getClientSync();


// asynchronous
pool.getClient().then(function(client){
  
  
});





```
