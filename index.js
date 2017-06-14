'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
var util = require('util');
var ldap = require('ldapjs');
var poolId = 0;
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
            console.log("client with id => " + client.cdtClientId + " is idle.");
            client.ldapPoolRemoved = true;
            clearActive(_this, client);
            clearInactive(_this, client);
            _this.addClient();
            client.unbind(function () {
                client.destroy();
            });
        });
        client.on('error', function (e) {
            console.error(" => LDAP client error (in client pool, id=" + client.cdtClientId + ") => ", e.stack || e);
            client.ldapPoolRemoved = true;
            clearActive(_this, client);
            clearInactive(_this, client);
            _this.addClient();
            client.unbind(function () {
                client.destroy();
            });
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
        client.returnToPool = function () {
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
