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

  console.log('this.connOpts =>', this.connOpts);


  for (let i = 0; i < this.size; i++) {

    let client = ldap.createClient(this.connOpts);

    client.cdtClientId = i;

    client.on('idle', function(){
      console.log(`client with id => ${client.cdtClientId} is idle.`);
    });

    client.on('error', function (e) {
      console.error(` => LDAP client error (in client pool, id=${this.cdtClientId}) => `, e.stack || e);
    });

    client.bind(this.dn, this.pwd, function (err) {
      if (err) {
        console.error(err);
      }
      else {
        console.log('Successfully bound client.');
      }
    });

    this.inactive.push(client);

    client.returnToPool = () => {

      let fn;

      if (fn = this.waitingForClient.pop()) {
        fn(client);
      }
      else {

        this.active = this.active.filter(function (v) {
          return v !== client;
        });

        this.inactive.unshift(client);
        // createTimeout(this, client);

      }

    };

  }

}

Pool.create = function (opts) {
  return new Pool(opts);
};

Pool.prototype.getClient = function () {

  let c = this.inactive.pop();

  if (c) {
    this.active.unshift(c);
    return Promise.resolve(c);
  }
  else {
    return new Promise(resolve => {
      this.waitingForClient.unshift(resolve);
    });
  }

};

Pool.prototype.getClientSync = function () {

  let c;
  if (c = this.inactive.pop()) {
    clearTimeout(c.__inactiveTimeoutX);
    this.active.unshift(c);
    return c;
  }

  let oldestActive = this.active.length - 1;
  return this.active[oldestActive];

};

Pool.prototype.returnClientToPool = function (c) {

  let fn;

  if (fn = this.waitingForClient.pop()) {
    fn(c);
  }
  else {

    this.active = this.active.filter(function (v) {
      return v !== c;
    });

    this.inactive.unshift(c);
    // createTimeout(this, c);
  }

};

function createTimeout(pool, client, timeout) {

  client.__inactiveTimeoutX = setTimeout(function () {

    let isDestroyable = false;
    pool.inactive = pool.inactive.filter(function (v) {
      if (v === client) {
        isDestroyable = true;
        return false;
      }
      return true;
    });

    if (isDestroyable) {
      client.unbind(function () {
        client.destroy();
      });
    }

  }, timeout || 30000);

}

module.exports = Pool;