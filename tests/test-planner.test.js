const { test, describe } = require('node:test');
const assert = require('node:assert');
const { generateTestPlan } = require('../src/test-planner');

describe('Test Planner', () => {
  const parsedTicket = {
    title: 'User profile update',
    description: 'Users can update their name and email in Settings.',
    acceptanceCriteria: [
      'Valid changes are saved.',
      'Invalid emails are rejected.',
      'Changes persist after refreshing.',
      'API failures display an appropriate error.'
    ],
    applicationUrl: 'http://localhost:3000',
    environment: 'local development',
    entities: ['name', 'email', 'profile', 'settings']
  };

  test('generates risk-based test scenarios covering all acceptance criteria', () => {
    const plan = generateTestPlan(parsedTicket);
    assert.strictEqual(plan.ticketTitle, 'User profile update');
    assert.strictEqual(plan.targetUrl, 'http://localhost:3000');
    assert.ok(plan.totalScenarios >= 4);

    const testTypes = plan.scenarios.map(s => s.testType);
    assert.ok(testTypes.includes('happy_path'), 'Must contain happy path scenario');
    assert.ok(testTypes.includes('invalid_email'), 'Must contain invalid email rejection scenario');
    assert.ok(testTypes.includes('empty_name'), 'Must contain empty required name scenario');
    assert.ok(testTypes.includes('persistence_refresh'), 'Must contain persistence after refresh scenario');
    assert.ok(testTypes.includes('api_failure'), 'Must contain API failure scenario');
  });

  test('does not generate unrelated arbitrary tests', () => {
    const plan = generateTestPlan(parsedTicket);
    plan.scenarios.forEach(s => {
      assert.ok(
        s.category.includes('Acceptance') ||
        s.category.includes('Validation') ||
        s.category.includes('Persistence') ||
        s.category.includes('Error Handling') ||
        s.category.includes('Boundary')
      );
      assert.ok(s.targetUrl === 'http://localhost:3000');
      assert.ok(s.steps.length > 0);
      assert.ok(s.expectedOutcome.length > 0);
    });
  });
});
