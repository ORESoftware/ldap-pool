
//core
import Timer = NodeJS.Timer;
const util = require('util');

//npm
const ldap = require('ldapjs');


//project
let poolId = 0;


export interface ILDAPPoolOpts {
  id: number;
  size: number;
  connOpts: any;
  active: Array<any>;
  inactive: Array<any>;
  dn: string;
  pwd: string;
  waitingForClient: Array<Function>
}

export interface IClient{
  __inactiveTimeoutX: Timer,
  bind: Function,
  unbind: Function
  destroy: Function
}


function createTimeout(pool: Pool, client: IClient, timeout?: number) {

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


export default class Pool {

  id: number;
  size: number;
  connOpts: any;
  active: Array<IClient>;
  inactive: Array<IClient>;
  dn: string;
  pwd: string;
  waitingForClient: Array<Function>;

  constructor(opts: ILDAPPoolOpts) {

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

      client.on('idle', function () {
        console.log(`client with id => ${client.cdtClientId} is idle.`);
      });

      client.on('error', function (e: Error) {
        console.error(` => LDAP client error (in client pool, id=${this.cdtClientId}) => `, e.stack || e);
      });

      client.bind(this.dn, this.pwd, function (err: Error) {
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

  static create(opts: ILDAPPoolOpts) {
    return new Pool(opts);
  }

  getClient() : Promise<IClient> {

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

  }


  getClientSync() : IClient {

    let c;
    if (c = this.inactive.pop()) {
      clearTimeout(c.__inactiveTimeoutX);
      this.active.unshift(c);
      return c;
    }

    let oldestActive = this.active.length - 1;
    return this.active[oldestActive];

  }


  returnClientToPool(c: IClient) : void {

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


}



