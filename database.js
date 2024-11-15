/*-*/; var database = (function() { 'use strict';
    /**
     * @typedef {{
     *     new(plain?: any): any,
     *     objectStoreOptions: IDBObjectStoreParameters,
     *     objectStoreIndexes: { [name: string]: { keyPath: string | string[], options?: IDBIndexParameters } }
     * }} Store
     */

    /** @template {{[name: string]: Store}} S */
    class Database {
        /** @type {string} */ name;
        /** @type {number} */ version;
        /** @type {S} */ stores;
        /** @type {IDBDatabase?} */ _idb = null;
        /**
         * @param {string} name
         * @param {number} version
         * @param {S} stores
         */
        constructor(name, version, stores) {
            this.name = name
            this.version = version;
            this.stores = stores;
        }

        /** @returns {Promise<IDBDatabase>} */
        idb() {
            return Promise.resolve(this._idb || new Promise((res, rej) => {
                const req = indexedDB.open(this.name, this.version);
                req.onsuccess = _ => {
                    /** @param {any} ev */
                    req.result.onerror = ev => console.error(ev.target.error);
                    res(this._idb = req.result);
                };
                req.onblocked = req.onerror = _ => rej(req.error);
                req.onupgradeneeded = _ => {
                    for (const name in this.stores) {
                        const store = this.stores[name];
                        const exists = req.result.objectStoreNames.contains(name);
                        const ostore = exists ? req.transaction.objectStore(name) : req.result.createObjectStore(name, store.objectStoreOptions);
                        if (exists) ostore.openCursor().onsuccess = /** @param {any} ev */ ev => {
                            /** @type {IDBCursorWithValue} */
                            const cursor = ev.target.result;
                            if (!cursor) return;
                            const niw = new store(cursor.value).valueOf();
                            if (niw) cursor.update(niw);
                            else cursor.delete();
                            cursor.continue();
                        };
                        for (const name in store.objectStoreIndexes) {
                            const index = store.objectStoreIndexes[name];
                            if (!ostore.indexNames.contains(name)) ostore.createIndex(name, index.keyPath, index.options);
                        }
                        // @ts-ignore: iterable
                        for (const name of ostore.indexNames) if (!store.objectStoreIndexes[name]) ostore.deleteIndex(name);
                    }
                    // @ts-ignore: iterable
                    for (const name of req.result.objectStoreNames) if (!this.stores[name]) req.result.deleteObjectStore(name);
                };
            }));
        }

        /**
         * @param {new(plain?: any) => C} store
         * @param {IDBTransactionMode} [mode]
         * @param {IDBTransactionOptions} [options]
         * @returns {Promise<Transaction<C>>}
         * @template C
         */
        transaction(store, mode, options) { return this.idb().then(db => new Transaction(db.transaction(store.name, mode, options), store)); }
    }

    function promisify(fn, args) {
        return new Promise((res, rej) => {
            const req = this[fn].apply(this, args);
            req.onsuccess = ev => res(ev.target.result);
            req.onerror = ev => rej(ev.target.error);
        });
    }

    /** @template C */
    class Transaction {
        /** @type {new(plain?: any) => C} */ store;
        /** @type {IDBObjectStore} */ objectStore;
        constructor(trans, store) {
            this.store = store;
            this.objectStore = trans.objectStore(store.name);
        }

        /**
         * @param {C} value
         * @param {IDBValidKey} [key]
         * @returns {Promise<IDBValidKey>}
         */
        add(value, key) { return promisify.call(this.objectStore, 'add', [value, key]); }
        /**
         * @param {IDBValidKey | IDBKeyRange | undefined} query
         * @returns {Promise<number>}
         */
        count(query) { return promisify.call(this.objectStore, 'count', [query]); }
        /**
         * @param {IDBValidKey | IDBKeyRange | null} [query]
         * @param {IDBCursorDirection} [direction]
         * @returns {Cursor<C>}
         */
        cursor(query, direction) { return new Cursor(this.objectStore.openCursor(query, direction), this.store); }
        /**
         * @param {IDBValidKey | IDBKeyRange} query
         * @returns {Promise<void>}
         */
        delete(query) { return promisify.call(this.objectStore, 'delete', [query]); }
        /**
         * @param {IDBValidKey | IDBKeyRange} query
         * @returns {Promise<C>}
         */
        get(query) { return promisify.call(this.objectStore, 'get', [query]).then(r => new this.store(r)); }
        /**
         * @param {string} name
         * @returns {Index<C>}
         */
        index(name) { return new Index(this.objectStore.index(name), this.store); }
        /**
         * @param {C} item
         * @param {IDBValidKey} [key]
         * @returns {Promise<IDBValidKey>}
         */
        put(item, key) { return promisify.call(this.objectStore, 'put', [item, key]); }
    }

    /** @template C */
    class Index {
        /** @type {new(plain?: any) => C} */ store;
        /** @type {IDBIndex} */ index;
        constructor(index, store) {
            this.store = store;
            this.index = index;
        }
        /**
         * @param {IDBValidKey | IDBKeyRange} [query]
         * @returns {Promise<number>}
         */
        count(query) { return promisify.call(this.index, 'count', [query]); }
        /**
         * @param {IDBValidKey | IDBKeyRange | null} [query]
         * @param {IDBCursorDirection} [direction]
         * @returns {Cursor<C>}
         */
        cursor(query, direction) { return new Cursor(this.index.openCursor(query, direction), this.store); }
        /**
         * @param {IDBValidKey | IDBKeyRange} query
         * @returns {Promise<C>}
         */
        get(query) { return promisify.call(this.index, 'get', [query]).then(r => new this.store(r)); }
    }

    /** @template C */
    class Cursor {
        /** @type {new(plain?: any) => C} */ store;
        /** @type {IDBRequest<IDBCursorWithValue | null>} */ openedCursor;
        /** @type {IDBCursorWithValue?} */ _cursor = null;
        _done = false;
        constructor(opened, store) {
            this.store = store;
            this.openedCursor = opened;
        }
        [Symbol.asyncIterator]() { return this; }

        /** @returns {Promise<{done: boolean, value: [IDBValidKey, C, IDBCursorWithValue]}>} */
        next() {
            // @ts-ignore: value being undefined
            return this._done ? Promise.resolve({ done: true }) : new Promise((res, rej) => {
                this.openedCursor.onerror = _ => rej(this.openedCursor.error);
                this.openedCursor.onsuccess = _ => {
                    const c = this._cursor = this.openedCursor.result;
                    res({ done: this._done = !c, value: c && [c.primaryKey, new this.store(c.value), c] });
                };
                if (this._cursor) this._cursor.continue();
            });
        }

        /**
         * @param {(value: [IDBValidKey, C, IDBCursorWithValue]) => void} does
         * @returns {Promise<void>}
         */
        forEach(does) {
            // TODO: maybe write it out directly, to 'optimize' out building promises and lambdas
            return this.next().then(({ done, value }) => done || (does(value), this.forEach(does)));
        }
    }

    /**
     * @template {{[name: string]: Store}} S
     * @param {string} name
     * @param {number} version
     * @param {S} stores
     */
    return (name, version, stores) => new Database(name, version, stores);
})();
