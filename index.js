

const ldap = require('ldapjs');

let poolId = 0;

function Pool(opts){

  this.id = ++poolId;
  this.size = opts.size;
  this.connOpts = opts.connOpts;
  this.active = [];
  this.inactive = [];
  this.dn = opts.dn;
  this.pwd = opts.pwd;

  for(let i = 0; i < this.size; i++){

    let client = ldap.createClient(this.connOpts);

    client.cdtClientId = i;

    client.on('error', function (e) {
      console.error(` => LDAP client error (in client pool, id=${this.cdtClientId}) => `, e.stack || e);
    });

    client.bind(this.dn, this.pwd);
    this.inactive.push(client);

  }

}



Pool.prototype.getClient = function(){


};