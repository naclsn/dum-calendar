/*-*/;var database = (function() { 'use strict';
    /** @template {{[name: string]: Store}} S */
    class Database {
        /** @type {string} */ name;
        /** @type {S} */ stores;
        /** @type {IDBDatabase?} */ _idb = null;
        /**
         * @param {string} name
         * @param {S} stores
         */
        constructor(name, stores) {
            this.name = name
            this.stores = stores;
        }
        /** @returns {Promise<IDBDatabase>} */
        idb() {
            return Promise.resolve(this._idb || new Promise((res, rej) => {
                const req = indexedDB.open(name, migrations.length);
                req.onsuccess = _ => {
                    req.result.onerror = err => console.error(err);
                    res(this._idb = req.result);
                };
                req.onblocked = req.onerror = _ => rej(req.error);
                req.onupgradeneeded = _ => {
                    for (const name in this.stores) {
                        const store = this.stores[name];
                        const exists = req.result.objectStoreNames.contains(name);
                        const ostore = exists
                            ? req.result.transaction(name, 'readwrite').objectStore(name)
                            : req.result.createObjectStore(name, store.objectStoreOptions);
                        if (exists) ostore.openCursor().onsuccess = ev => {
                            /** @type {IDBCursorWithValue} */
                            const cursor = ev.target.result;
                            if (!cursor) return;
                            cursor.update(new store(cursor.value));
                            cursor.continue();
                        };
                        for (const name in store.objectStoreIndexes) {
                            const index = store.objectStoreIndexes[name];
                            ostore.createIndex(name, index.keyPath, index.options);
                        }
                        for (const name of ostore.indexNames) if (!store.objectStoreIndexes[name]) ostore.deleteIndex(name);
                    }
                    for (const name of req.result.objectStoreNames) if (!this.stores[name]) req.result.deleteObjectStore(name);
                };
            }));
        }
        /**
         * @param {new() => C} store
         * @returns {Promise<Transaction<C>>}
         * @template C
         */
        transaction(store) { return this.idb().then(r => new Transaction(r, store)); }
    }

    /** @template C */
    class Transaction {
        /** @type {new() => C} */ store;
        /** @type {IDBObjectStore} */ objectStore;
        constructor(db, store) {
            this.store = store;
            this.objectStore = db.transaction(store.name).objectStore(store.name);
        }
        promisify(fn, args) {
            return new Promise((res, rej) => {
                const req = this.objectStore[fn].apply(this.objectStore, args);
                req.onsuccess = ev => res(ev.target.result);
                req.onerror = ev => rej(ev.target.error);
            });
        }
        /**
         * @param {C} value
         * @param {IDBCursorWithValue?} key
         * @returns {Promise<IDBValidKey>}
         */
        add(value, key) { return this.promisify('add', [value, key]); }
        /**
         * @param {C} item
         * @param {IDBCursorWithValue?} key
         * @returns {Promise<IDBValidKey>}
         */
        put(item, key) { return this.promisify('put', [item, key]); }
        /**
         * @param {IDBValidKey | IDBKeyRange} query
         * @returns {Promise<C>}
         */
        get(query) { return this.promisify('get', [query]).then(r => new this.store(r)); }
        /**
         * @param {string} name
         * @returns {Index<C>}
         */
        index(name) { return new Index(this.objectStore.index(name), this); }
    }

    /** @template C */
    class Index {
        /** @type {IDBIndex} */ index;
        constructor(index) {
            this.index = index;
        }
    }

    /** @template C */
    class Cursor {}

    /**
     * @typedef {{
     *     new() => any,
     *     objectStoreOptions: IDBObjectStoreParameters,
     *     objectStoreIndexes: { [name: string]: { keyPath: string | Iterable<string>, options?: IDBIndexParameters } }
     * }} Store
     *
     * @template {{[name: string]: Store}} S
     * @param {string} name
     * @param {S} stores
     */
    return (name, stores) => new Database(name, stores);
})();
