'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var util = require('util');
var ldap = require('ldapjs');
var chalk = require('chalk');
var poolId = 0;
var log = console.log.bind(console, chalk.green(' => [ldap-pool] =>'));
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
function logSize(pool) {
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
            log("client with id => " + client.cdtClientId + " is idle.");
            logSize(_this);
            client.ldapPoolRemoved = true;
            clearActive(_this, client);
            clearInactive(_this, client);
            _this.addClient();
            client.unbind(function () {
                client.destroy();
                client.removeAllListeners();
            });
        });
        client.on('error', function (e) {
            if (client.ldapPoolRemoved) {
                return;
            }
            logError("client error (in client pool, id=" + client.cdtClientId + ") => \n", e.stack || e);
            logSize(_this);
            client.ldapPoolRemoved = true;
            clearActive(_this, client);
            clearInactive(_this, client);
            _this.addClient();
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
        client.returnToPool = function () {
            logSize(_this);
            if (client.ldapPoolRemoved) {
                return;
            }
            var fn;
            if (fn = _this.waitingForClient.pop()) {
                fn(client);
            }
            else {
                clearActive(_this, client);
                _this.inactive.unshift(client);
            }
        };
    };
    Pool.prototype.getClient = function () {
        var _this = this;
        logSize(this);
        var c = this.inactive.pop();
        if (c) {
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
        logSize(this);
        var c;
        if (c = this.inactive.pop()) {
            clearTimeout(c.__inactiveTimeoutX);
            this.active.unshift(c);
            return c;
        }
        var oldestActive = this.active.length - 1;
        return this.active[oldestActive];
    };
    Pool.prototype.returnClientToPool = function (c) {
        logSize(this);
        if (c.ldapPoolRemoved) {
            return;
        }
        var fn;
        if (fn = this.waitingForClient.pop()) {
            fn(c);
        }
        else {
            clearActive(this, c);
            this.inactive.unshift(c);
        }
    };
    ;
    return Pool;
}());
exports.Pool = Pool;
var $exports = module.exports;
exports.default = $exports;
