'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var util = require('util');
var ldap = require("ldapjs");
var chalk = require("chalk");
var poolId = 0;
var log = console.log.bind(console, chalk.blue(' => [ldap-pool] =>'));
var logError = console.error.bind(console, chalk.yellow(' => [ldap-pool] => warning =>'));
function createTimeout(pool, client, timeout) {
    client.__inactiveTimeoutX = setTimeout(function () {
        var isDestroyable = false;
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
function clearActive(pool, c) {
    pool.active = pool.active.filter(function (v) {
        return v !== c;
    });
}
function clearInactive(pool, c) {
    pool.inactive = pool.inactive.filter(function (v) {
        return v !== c;
    });
}
function logSize(pool, event) {
    log(event || '');
    log('added/created clients count => ', pool.numClientsAdded);
    log('destroyed clients count => ', pool.numClientsDestroyed);
    log('active clients count => ', pool.active.length);
    log('inactive clients count => ', pool.inactive.length);
    log('total clients count => ', pool.inactive.length + pool.active.length);
}
var Pool = (function () {
    function Pool(opts) {
        this.id = ++poolId;
        this.size = opts.size;
        this.connOpts = opts.connOpts;
        this.active = [];
        this.inactive = [];
        this.dn = opts.dn;
        this.pwd = opts.pwd;
        this.waitingForClient = [];
        this.numClientsAdded = 0;
        this.numClientsDestroyed = 0;
        this.verbosity = opts.verbosity || 2;
        this.clientId = 1;
        for (var i = 0; i < this.size; i++) {
            this.addClient();
        }
    }
    Pool.create = function (opts) {
        return new Pool(opts);
    };
    Pool.prototype.addClient = function () {
        var _this = this;
        var client = ldap.createClient(this.connOpts);
        client.cdtClientId = this.clientId++;
        client.on('idle', function () {
            if (client.ldapPoolRemoved) {
                return;
            }
            ++_this.numClientsDestroyed;
            log(chalk.yellow("client with id => " + client.cdtClientId + " is idle."));
            logSize(_this, 'event: idle');
            client.ldapPoolRemoved = true;
            _this.addClient();
            clearActive(_this, client);
            clearInactive(_this, client);
            client.unbind(function () {
                client.destroy();
                client.removeAllListeners();
            });
        });
        client.on('error', function (e) {
            clearTimeout(client.__inactiveTimeoutX);
            if (client.ldapPoolRemoved) {
                return;
            }
            ++_this.numClientsDestroyed;
            logError("client error (in client pool, id=" + client.cdtClientId + ") => \n", e.stack || e);
            logSize(_this, 'event: error');
            client.ldapPoolRemoved = true;
            _this.addClient();
            clearActive(_this, client);
            clearInactive(_this, client);
            client.unbind(function () {
                client.destroy();
                client.removeAllListeners();
            });
        });
        client.bind(this.dn, this.pwd, function (err) {
            if (err) {
                logError('\n', err.stack || err);
            }
            else {
                log('Successfully bound client.');
            }
        });
        this.inactive.push(client);
        ++this.numClientsAdded;
        logSize(this, 'event: add');
        client.returnToPool = function () {
            logSize(_this, 'event: return to pool');
            if (client.ldapPoolRemoved) {
                return;
            }
            var fn;
            if (fn = _this.waitingForClient.pop()) {
                fn(client);
            }
            else {
                clearActive(_this, client);
                clearInactive(_this, client);
                _this.inactive.unshift(client);
            }
        };
    };
    Pool.prototype.getClient = function () {
        var _this = this;
        logSize(this, 'event: get client');
        var c = this.inactive.pop();
        if (c) {
            clearTimeout(c.__inactiveTimeoutX);
            clearInactive(this, c);
            clearActive(this, c);
            this.active.unshift(c);
            return Promise.resolve(c);
        }
        else {
            return new Promise(function (resolve) {
                _this.waitingForClient.unshift(resolve);
            });
        }
    };
    Pool.prototype.getClientSync = function () {
        logSize(this, 'event: get client sync');
        var c;
        if (c = this.inactive.pop()) {
            clearInactive(this, c);
            clearActive(this, c);
            clearTimeout(c.__inactiveTimeoutX);
            this.active.unshift(c);
            return c;
        }
        var oldestActive = this.active.length - 1;
        c = this.active[oldestActive];
        clearTimeout(c.__inactiveTimeoutX);
        return c;
    };
    Pool.prototype.returnClientToPool = function (c) {
        if (!c) {
            throw new Error('You must pass a client object of type IClient as the first argument to this method.');
        }
        logSize(this, 'event: return client to pool');
        if (c.ldapPoolRemoved) {
            return;
        }
        var fn;
        if (fn = this.waitingForClient.pop()) {
            fn(c);
        }
        else {
            clearActive(this, c);
            clearInactive(this, c);
            this.inactive.unshift(c);
        }
    };
    ;
    return Pool;
}());
exports.Pool = Pool;
var $exports = module.exports;
exports.default = $exports;
