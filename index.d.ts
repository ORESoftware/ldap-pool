/// <reference types="node" />
import Timer = NodeJS.Timer;
import { Client } from '@types/ldapjs';
export interface IConnOpts {
    reconnect?: boolean;
    url: string;
}
export interface ILDAPPoolOpts {
    size?: number;
    connOpts: IConnOpts;
    dn: string;
    pwd: string;
    verbosity?: number;
}
export interface IClient extends Client {
    __inactiveTimeoutX: Timer;
    returnToPool: Function;
    ldapPoolRemoved?: boolean;
    cdtClientId: number;
}
export declare class ILDAPPool {
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
    constructor(opts: ILDAPPoolOpts);
    static create(opts: ILDAPPoolOpts): ILDAPPool;
    addClient(): void;
    getClient(): Promise<IClient>;
    getClientSync(): IClient;
    returnClientToPool(c: IClient): void;
}
export declare const Pool: typeof ILDAPPool;
declare let $exports: any;
export default $exports;
