"use strict";
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
var Pool = (function () {
    function Pool(opts) {
        var _this = this;
        this.id = ++poolId;
        this.size = opts.size;
        this.connOpts = opts.connOpts;
        this.active = [];
        this.inactive = [];
        this.dn = opts.dn;
        this.pwd = opts.pwd;
        this.waitingForClient = [];
        var _loop_1 = function (i) {
            var client = ldap.createClient(this_1.connOpts);
            client.cdtClientId = i;
            client.on('idle', function () {
                console.log("client with id => " + client.cdtClientId + " is idle.");
            });
            client.on('error', function (e) {
                console.error(" => LDAP client error (in client pool, id=" + this.cdtClientId + ") => ", e.stack || e);
            });
            client.bind(this_1.dn, this_1.pwd, function (err) {
                if (err) {
                    console.error(err);
                }
                else {
                    console.log('Successfully bound client.');
                }
            });
            this_1.inactive.push(client);
            client.returnToPool = function () {
                var fn;
                if (fn = _this.waitingForClient.pop()) {
                    fn(client);
                }
                else {
                    _this.active = _this.active.filter(function (v) {
                        return v !== client;
                    });
                    _this.inactive.unshift(client);
                }
            };
        };
        var this_1 = this;
        for (var i = 0; i < this.size; i++) {
            _loop_1(i);
        }
    }
    Pool.create = function (opts) {
        return new Pool(opts);
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
        var fn;
        if (fn = this.waitingForClient.pop()) {
            fn(c);
        }
        else {
            this.active = this.active.filter(function (v) {
                return v !== c;
            });
            this.inactive.unshift(c);
        }
    };
    ;
    return Pool;
}());
exports.default = Pool;
