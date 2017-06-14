/// <reference types="node" />
import Timer = NodeJS.Timer;
export interface ILDAPPoolOpts {
    id: number;
    size: number;
    connOpts: any;
    active: Array<any>;
    inactive: Array<any>;
    dn: string;
    pwd: string;
    waitingForClient: Array<Function>;
}
export interface IClient {
    __inactiveTimeoutX: Timer;
    bind: Function;
    unbind: Function;
    destroy: Function;
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
    constructor(opts: ILDAPPoolOpts);
    static create(opts: ILDAPPoolOpts): Pool;
    getClient(): Promise<IClient>;
    getClientSync(): IClient;
    returnClientToPool(c: IClient): void;
}
