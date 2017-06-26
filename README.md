

# LDAP Pool - a simple client pool for LDAP connections

## This API is promise-based - so as to work well with async/await flow control.

## Installation

```bash
npm install -S ldap-pool

```

## Usage

```typescript

import {Pool, ILDAPPool, IClient} from 'ldap-pool';

let pool : ILDAPPool = new Pool({


});


// synchronous
let client : IClient = pool.getClientSync();


// asynchronous
pool.getClient().then(function(c: IClient){
  
  
});

```

The asynchronous getClient method is preferred, because this can guarantee we use a client that is
not already active. Although it shouldn't matter that much.

Here we have a full use cycle:

```typescript

let client : IClient = pool.getClientSync();

client.search('foo',opts,function(err,res){
  
  
  // when you're done, return the client to the pool
  // this is important for performance, but not imperative for functionality
  client.returnToPool();
  
});

```

