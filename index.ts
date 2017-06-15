'use strict';

import Timer = NodeJS.Timer;

//core
const util = require('util');

//npm
const ldap = require('ldapjs');
const chalk = require('chalk');

//project
let poolId = 0;
let log = console.log.bind(console, chalk.blue(' => [ldap-pool] =>'));
let logError = console.error.bind(console, chalk.yellow(' => [ldap-pool] => warning =>'));

//////////////////////////////////////////////////////////////////////


export interface IConnOpts {
  reconnect: boolean
}


export interface ILDAPPoolOpts {
  id: number;
  size: number;
  connOpts: IConnOpts;
  active: Array<IClient>;
  inactive: Array<IClient>;
  dn: string;
  pwd: string;
  waitingForClient: Array<Function>,
  clientId: number;
  numClientsAdded: number;
  numClientsDestroyed: number;
  verbosity: number;
}

export interface IClient {
  __inactiveTimeoutX: Timer,
  bind: Function,
  unbind: Function
  destroy: Function,
  returnToPool: Function,
  ldapPoolRemoved?: boolean
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

function clearActive(pool: Pool, c: IClient) {
  pool.active = pool.active.filter(function (v) {
    return v !== c;
  });
}

function clearInactive(pool: Pool, c: IClient) {
  pool.inactive = pool.inactive.filter(function (v) {
    return v !== c;
  });
}

function logSize(pool: Pool, event: string) {
  log(event || '');
  log('added/created clients count => ', pool.numClientsAdded);
  log('destroyed clients count => ', pool.numClientsDestroyed);
  log('active clients count => ', pool.active.length);
  log('inactive clients count => ', pool.inactive.length);
  log('total clients count => ', pool.inactive.length + pool.active.length);
}

export class Pool {

  id: number;
  size: number;
  connOpts: any;
  active: Array<IClient>;
  inactive: Array<IClient>;
  dn: string;
  pwd: string;
  waitingForClient: Array<Function>;
  clientId: number;
  numClientsAdded: number;
  numClientsDestroyed: number;
  verbosity: number;

  constructor(opts: ILDAPPoolOpts) {

    this.id = ++poolId;
    this.size = opts.size;
    this.connOpts = opts.connOpts;
    this.active = [];
    this.inactive = [];
    this.dn = opts.dn;
    this.pwd = opts.pwd;
    this.waitingForClient = [];   // these are resolve functions waiting to be called
    this.numClientsAdded = 0;
    this.numClientsDestroyed = 0;
    this.verbosity = opts.verbosity || 2;

    this.clientId = 1;

    for (let i = 0; i < this.size; i++) {
      this.addClient();
    }

  }

  static create(opts: ILDAPPoolOpts) {
    return new Pool(opts);
  }

  addClient(): void {

    let client = ldap.createClient(this.connOpts);
    client.cdtClientId = this.clientId++;

    client.on('idle', () => {
      if (client.ldapPoolRemoved) {
        return;
      }
      ++this.numClientsDestroyed;
      log(chalk.yellow(`client with id => ${client.cdtClientId} is idle.`));
      logSize(this,'event: idle');
      client.ldapPoolRemoved = true;
      clearActive(this, client);
      clearInactive(this, client);
      this.addClient();
      client.unbind(function () {
        client.destroy();
        client.removeAllListeners();
      });
    });

    client.on('error', (e: Error) => {
      if (client.ldapPoolRemoved) {
        return;
      }
      ++this.numClientsDestroyed;
      logError(`client error (in client pool, id=${client.cdtClientId}) => \n`, e.stack || e);
      logSize(this, 'event: error');
      client.ldapPoolRemoved = true;
      clearActive(this, client);
      clearInactive(this, client);
      this.addClient();
      client.unbind(function () {
        client.destroy();
        client.removeAllListeners();
      });
    });

    client.bind(this.dn, this.pwd, function (err: Error) {
      if (err) {
        logError('\n', err.stack || err);
      }
      else {
        log('Successfully bound client.');
      }
    });

    this.inactive.push(client);
    ++this.numClientsAdded;
    logSize(this,'event: add');

    client.returnToPool = () => {

      logSize(this,'event: return to pool');

      if (client.ldapPoolRemoved) {
        // we marked this client as removed
        return;
      }

      let fn;

      if (fn = this.waitingForClient.pop()) {
        fn(client);
      }
      else {
        clearActive(this, client);
        clearInactive(this, client);
        this.inactive.unshift(client);
        // createTimeout(this, client);
      }

    };
  }

  getClient(): Promise<IClient> {

    logSize(this,'event: get client');

    let c = this.inactive.pop();

    if (c) {
      clearInactive(this, c);
      clearActive(this, c);
      this.active.unshift(c);
      return Promise.resolve(c);
    }
    else {
      return new Promise(resolve => {
        this.waitingForClient.unshift(resolve);
      });
    }

  }


  getClientSync(): IClient {

    logSize(this, 'event: get client sync');

    let c;
    if (c = this.inactive.pop()) {
      clearInactive(this, c);
      clearTimeout(c.__inactiveTimeoutX);
      this.active.unshift(c);
      return c;
    }

    let oldestActive = this.active.length - 1;
    return this.active[oldestActive];

  }


  returnClientToPool(c: IClient): void {

    logSize(this, 'event: return client to pool');

    if (c.ldapPoolRemoved) {
      // we marked this client as removed
      return;
    }

    let fn;

    if (fn = this.waitingForClient.pop()) {
      fn(c);
    }
    else {

      clearActive(this, c);
      clearInactive(this, c);
      this.inactive.unshift(c);
      // createTimeout(this, c);
    }

  };


}


let $exports = module.exports;
export default $exports;



