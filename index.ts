'use strict';

import Timer = NodeJS.Timer;
import {Client} from '@types/ldapjs';

//core
import * as util from 'util';
import * as assert from 'assert';

//npm
import * as ldap from 'ldapjs';
import * as chalk from 'chalk';

//project
let poolId = 0;
let log = console.log.bind(console, chalk.blue(' => [ldap-pool] =>'));
let logError = console.error.bind(console, chalk.yellow(' => [ldap-pool] => warning =>'));

//////////////////////////////////////////////////////////////////////

export interface IConnOpts {
  reconnect?: boolean,
  url: string,
  idleTimeout?: number
}

export interface ILDAPPoolOpts {
  size?: number;
  connOpts: IConnOpts;
  dn: string;
  pwd: string;
  verbosity?: number;
}

export interface IClient extends Client {
  __inactiveTimeoutX: Timer,
  returnToPool: Function,
  ldapPoolRemoved?: boolean
  cdtClientId: number;
}

function createTimeout(pool: ILDAPPool, client: IClient, timeout?: number) {

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

function clearActive(pool: ILDAPPool, c: IClient) {
  pool.active = pool.active.filter(function (v) {
    return v !== c;
  });
}

function clearInactive(pool: ILDAPPool, c: IClient) {
  pool.inactive = pool.inactive.filter(function (v) {
    return v !== c;
  });
}

function logSize(pool: ILDAPPool, event: string) {
  log(event || '');
  log('added/created clients count => ', pool.numClientsAdded);
  log('destroyed clients count => ', pool.numClientsDestroyed);
  log('active clients count => ', pool.active.length);
  log('inactive clients count => ', pool.inactive.length);
  log('total clients count => ', pool.inactive.length + pool.active.length);
}

export class ILDAPPool {

  id: number;
  size: number;
  connOpts: IConnOpts;
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
    const connOpts = this.connOpts = opts.connOpts;
    this.connOpts.idleTimeout = this.connOpts.idleTimeout || 30000;
    this.active = [];
    this.inactive = [];
    this.dn = opts.dn;
    this.pwd = opts.pwd;
    this.waitingForClient = [];   // these are resolve functions waiting to be called
    this.numClientsAdded = 0;
    this.numClientsDestroyed = 0;
    this.verbosity = opts.verbosity || 2;
    this.clientId = 1;


    assert(Number.isInteger(connOpts.idleTimeout) && connOpts.idleTimeout > 1000,
      'idleTimeout option should be an integer greater than 100.');

    for (let i = 0; i < this.size; i++) {
      this.addClient();
    }

  }

  static create(opts: ILDAPPoolOpts) {
    return new ILDAPPool(opts);
  }

  addClient(): void {

    let $opts = Object.assign({}, this.connOpts);
    $opts.idleTimeout = Math.round((Math.random() * $opts.idleTimeout*(1/3)) + $opts.idleTimeout*(5/6));
    log(chalk.magenta('new idleTimeout value => ', String($opts.idleTimeout)));

    let client = ldap.createClient($opts) as IClient;
    client.cdtClientId = this.clientId++;

    client.on('idle', () => {

      if (client.ldapPoolRemoved) {
        log(chalk.yellow(`client with id => ${client.cdtClientId} is idle, but client has already been removed.`));
        return;
      }
      log(chalk.yellow(`client with id => ${client.cdtClientId} is idle.`));
      ++this.numClientsDestroyed;
      logSize(this, 'event: idle');
      client.ldapPoolRemoved = true;
      this.addClient();
      clearActive(this, client);
      clearInactive(this, client);
      client.unbind(function () {
        client.destroy();
        client.removeAllListeners();
      });
    });

    client.on('error', (e: Error) => {
      logError(`client error (in client pool, id=${client.cdtClientId}) => \n`, e.stack || e);
      if (client.ldapPoolRemoved) {
        return;
      }
      ++this.numClientsDestroyed;
      logSize(this, 'event: error');
      client.ldapPoolRemoved = true;
      this.addClient();
      clearActive(this, client);
      clearInactive(this, client);
      client.unbind(function () {
        client.destroy();
        client.removeAllListeners();
      });
    });

    client.bind(this.dn, this.pwd, function (err: Error) {
      if (err) {
        logError('\n => Client bind error => ', err.stack || err);
      }
      else {
        log('Successfully bound client.');
      }
    });

    logSize(this, 'event: add');
    this.inactive.push(client);
    ++this.numClientsAdded;

    client.returnToPool = () => {

      logSize(this, 'event: return to pool');

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
      }
    };
  }

  getClient(): Promise<IClient> {

    logSize(this, 'event: get client');

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
      clearActive(this, c);
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
    }
  };
}

export const Pool = ILDAPPool;
let $exports = module.exports;
export default $exports;



