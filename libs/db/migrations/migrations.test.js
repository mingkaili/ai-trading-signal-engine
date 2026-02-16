const assert = require('node:assert');

const migration = require('./20260216_initial_schema');

assert.strictEqual(typeof migration.up, 'function');
assert.strictEqual(typeof migration.down, 'function');

console.log('Migration exports validated');
