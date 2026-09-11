'use strict';

// Local adapter ONLY: serializable transactions, copy-on-write rollback and revision.
// A production adapter must implement the same atomic contract in CloudBase; this is
// not a process-local lock to be deployed as a substitute for database transactions.
class MemoryRepository {
  constructor() { this.rows = new Map(); this.queue = Promise.resolve(); this.failNextCommit = false; }
  read(teacherId) {
    return structuredClone(this.rows.get(teacherId) || { teacherId, revision: 0, grants: [], access: null, students: [], audits: [], operations: {}, account: null });
  }
  transaction(teacherId, operation) {
    const run = this.queue.then(async () => {
      const draft = this.read(teacherId);
      const result = await operation(draft);
      if (this.failNextCommit) { this.failNextCommit = false; throw new Error('INJECTED_COMMIT_FAILURE'); }
      if (JSON.stringify(draft) !== JSON.stringify(this.read(teacherId))) {
        draft.revision++;
        this.rows.set(teacherId, structuredClone(draft));
      }
      return structuredClone(result);
    });
    this.queue = run.catch(() => {});
    return run;
  }
}
module.exports = { MemoryRepository };
