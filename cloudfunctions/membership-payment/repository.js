'use strict';
const { check } = require('./protocol');
const COLLECTIONS = Object.freeze({ audits: 'membership_admin_audit', products: 'membership_products', orders: 'membership_orders', intents: 'membership_payment_intents', claims: 'membership_payment_claims', events: 'membership_payment_events', work: 'membership_payment_work', ledgers: 'membership_ledgers', grants: 'membership_grants', accounts: 'membership_accounts' });
// @cloudbase/node-sdk database injected by a future authorized runtime composition.
// All transactional access uses deterministic document IDs; no transaction.where().
function createCloudbaseRepository(db, { maxAttempts = 4, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), collectionNames = COLLECTIONS, dueFilter = {} } = {}) {
  check(Number.isInteger(maxAttempts) && maxAttempts >= 1 && maxAttempts <= 5, 'INVALID_RETRY_BOUND');
  check(collectionNames && typeof collectionNames === 'object' && Object.values(collectionNames).every(name => typeof name === 'string' && /^[a-z][a-z0-9_]+$/.test(name)), 'INVALID_COLLECTION_MAP');
  const names = Object.freeze({ ...collectionNames });
  const collection = (scope, name) => { check(Object.hasOwn(names, name), 'INVALID_COLLECTION'); return scope.collection(names[name]); };
  const get = async (scope, name, key) => {
    const result = await collection(scope, name).doc(key).get();
    const data = Array.isArray(result.data) ? result.data[0] : result.data;
    if (!data) return null;
    const { _id, ...value } = data;
    return value;
  };
  return {
    get: (name, key) => get(db, name, key),
    async due(now, limit) {
      check(Number.isInteger(limit) && limit >= 1 && limit <= 50, 'INVALID_BATCH');
      const result = await collection(db, 'work').where({ ...dueFilter, state: 'pending', nextAt: db.command.lte(now) }).orderBy('nextAt', 'asc').limit(limit).get();
      return result.data.map(({ _id, ...value }) => value);
    },
    async transaction(operation) {
      for (let attempt = 1; ; attempt++) {
        try {
          const scope = await db.startTransaction();
          try {
            let count = 0;
            const budget = () => check(++count <= 90, 'TRANSACTION_OPERATION_LIMIT');
            const result = await operation({ get(name, key) { budget(); return get(scope, name, key); }, async put(name, key, value) {
              budget(); check(Buffer.byteLength(JSON.stringify(value)) <= 512000, 'LEDGER_DOCUMENT_CAPACITY_REQUIRES_REVIEW');
              await collection(scope, name).doc(key).set(value);
            } });
            await scope.commit();
            return result;
          } catch (error) {
            try { await scope.rollback(); } catch { /* preserve original failure */ }
            throw error;
          }
        } catch (error) {
          if (error.code !== 'DATABASE_TRANSACTION_CONFLICT' || attempt >= maxAttempts) throw error;
          await sleep(10 * attempt);
        }
      }
    }
  };
}
module.exports = { COLLECTIONS, createCloudbaseRepository };
