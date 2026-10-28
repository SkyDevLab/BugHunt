const { test, describe } = require('node:test');
const assert = require('node:assert');
const { FailureReproducer } = require('../src/reproducer');

describe('Failure Reproducer & Consistency Classifier', () => {
  const reproducer = new FailureReproducer({ maxAttempts: 2 });

  test('passes through already passed scenario', async () => {
    const result = await reproducer.verifyReproducibility(
      { id: 'TC-01' },
      { status: 'Passed' },
      {},
      {}
    );
    assert.strictEqual(result.classification, 'Passed');
    assert.strictEqual(result.reproducedFailures, 0);
  });

  test('preserves Blocked status when environment prevents testing', async () => {
    const result = await reproducer.verifyReproducibility(
      { id: 'TC-01' },
      { status: 'Blocked', reason: 'Connection refused' },
      {},
      {}
    );
    assert.strictEqual(result.classification, 'Blocked');
    assert.match(result.consistencyRate, /100%/);
  });

  test('classifies consistent failure as Confirmed (100% reproducible)', async () => {
    // Mock browser explorer that always fails
    const mockExplorer = {
      executeScenario: async () => ({
        status: 'Failed',
        reason: 'Assertion failed',
        evidence: { actual: 'Observed bug' }
      })
    };

    const result = await reproducer.verifyReproducibility(
      { id: 'TC-02' },
      { status: 'Failed', reason: 'Assertion failed', evidence: { actual: 'Observed bug' } },
      mockExplorer,
      {}
    );

    assert.strictEqual(result.classification, 'Confirmed');
    assert.strictEqual(result.reproducedFailures, 3); // 1 initial + 2 re-executions
    assert.strictEqual(result.reproductionAttempts, 3);
    assert.match(result.consistencyRate, /100% reproducible/);
  });

  test('classifies intermittent failure as Suspected', async () => {
    let callCount = 0;
    // Fails initial, fails 1st re-run, passes 2nd re-run
    const mockExplorer = {
      executeScenario: async () => {
        callCount++;
        return callCount === 1
          ? { status: 'Failed', reason: 'Flaky failure' }
          : { status: 'Passed' };
      }
    };

    const result = await reproducer.verifyReproducibility(
      { id: 'TC-03' },
      { status: 'Failed', reason: 'Initial failure' },
      mockExplorer,
      {}
    );

    assert.strictEqual(result.classification, 'Suspected');
    assert.strictEqual(result.reproducedFailures, 2);
    assert.strictEqual(result.reproductionAttempts, 3);
    assert.match(result.consistencyRate, /67% reproducible/);
  });

  test('classifies non-reproducible failure as Not Reproduced', async () => {
    // Passes both subsequent attempts
    const mockExplorer = {
      executeScenario: async () => ({ status: 'Passed' })
    };

    const result = await reproducer.verifyReproducibility(
      { id: 'TC-04' },
      { status: 'Failed', reason: 'One-off glitch' },
      mockExplorer,
      {}
    );

    assert.strictEqual(result.classification, 'Not Reproduced');
    assert.strictEqual(result.reproducedFailures, 1);
  });
});
