/// <reference types="node" />
import Timer = NodeJS.Timer;
export interface IConnOpts {
    reconnect: boolean;
}
export interface ILDAPPoolOpts {
    id: number;
    size: number;
    connOpts: IConnOpts;
    active: Array<any>;
    inactive: Array<any>;
    dn: string;
    pwd: string;
    waitingForClient: Array<Function>;
    clientId: number;
}
export interface IClient {
    __inactiveTimeoutX: Timer;
    bind: Function;
    unbind: Function;
    destroy: Function;
    returnToPool: Function;
}
export declare class Pool {
    id: number;
    size: number;
    connOpts: any;
    active: Array<IClient>;
    inactive: Array<IClient>;
    dn: string;
    pwd: string;
    waitingForClient: Array<Function>;
    clientId: number;
    constructor(opts: ILDAPPoolOpts);
    static create(opts: ILDAPPoolOpts): Pool;
    addClient(): void;
    getClient(): Promise<IClient>;
    getClientSync(): IClient;
    returnClientToPool(c: IClient): void;
}
declare let $exports: any;
export default $exports;
