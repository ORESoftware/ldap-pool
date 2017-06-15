#!/usr/bin/env node
'use strict';

const suman = require('suman');
const Test = suman.init(module, {
  pre: ['start-ldap-server']
});

Test.create(function (assert, it, beforeEach, Pool) {

  beforeEach(h => {

  });

  it.cb('size is zero', t => {

    let pool = new Pool({

      connOpts: {
        url: 'ldap://localhost:3890',
        reconnect: true,
        idleTimeout: 40000
      },
      size: 2,
      dn: 'o=example',
      pwd: 'cdt_main!@#$'
    });

    let c = pool.getClientSync();

    let opts = {
      filter: `uid=alexamil`,
      scope: 'sub',
      // attributes: ['uid','title']
      attributes: ['*']
    };

    c.search('o=example', opts, function (err, res) {

      if (err) {
        return t.done(err);
      }

      let user = null;

      res.once('searchEntry', function (entry) {
        user = entry.object;
      });

      res.once('searchReference', function (referral) {
        console.log('referral event: ' + referral.uris.join());
      });

      res.once('error', function (err) {
        console.error('error event: ' + err.message);
         t.done(err);
      });

      res.once('end', function (result) {
        console.log('status event: ' + result.status);

        c.returnToPool();
        t.done();

      });
    });

  });

});