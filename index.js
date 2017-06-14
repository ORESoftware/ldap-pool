const ldap = require('ldapjs');

let poolId = 0;

function Pool(opts) {

  this.id = ++poolId;
  this.size = opts.size;
  this.connOpts = opts.connOpts;
  this.active = [];
  this.inactive = [];
  this.dn = opts.dn;
  this.pwd = opts.pwd;

  // these are resolve functions waiting to be called
  this.waitingForClient = [];

  for (let i = 0; i < this.size; i++) {

    let client = ldap.createClient(this.connOpts);

    client.cdtClientId = i;

    client.on('error', function (e) {
      console.error(` => LDAP client error (in client pool, id=${this.cdtClientId}) => `, e.stack || e);
    });

    client.bind(this.dn, this.pwd);
    this.inactive.push(client);


    client.returnToPool = () => {

      this.active = this.active.filter(function (v) {
        return v !== client;
      });

      this.inactive.unshift(client);

      client.__inactiveTimeoutX = setTimeout(() => {

        let isDestroyable = false;
        this.inactive = this.inactive.filter(function (v) {
          if (v === client) {
            isDestroyable = true;
            return false;
          }
          return true;
        });

        if(isDestroyable){
          client.unbind(function(){
            client.destroy();
          });
        }

      }, 3000);
    };

  }

}

Pool.prototype.getClient = function () {

  let c = this.inactive.pop();

  if(c){
    this.active.unshift(c);
    return Promise.resolve(c);
  }
  else{
    return new Promise(resolve => {
       this.unshift(this.waitingForClient(resolve));
    });
  }

};

Pool.prototype.getClientSync = function () {

  let c;
  if(c = this.inactive.pop()){
    clearTimeout(c.__inactiveTimeoutX);
    this.active.unshift(c);
    return c;
  }

  let oldestActive = this.active.length - 1;
  return this.active[oldestActive];

};


Pool.prototype.returnClientToPool = function(c){

  let fn;

  if(fn = this.waitingForClient.pop()){
    fn(c);
  }
  else{
    this.inactive.unshift(c);
  }

};


module.exports = Pool;