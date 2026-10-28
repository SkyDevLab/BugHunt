const { test, describe } = require('node:test');
const assert = require('node:assert');
const { ReportGenerator } = require('../src/report-generator');

describe('Report Generator', () => {
  const generator = new ReportGenerator();

  test('formats complete markdown report and summary json', () => {
    const reportContext = {
      runId: 'run-2026-test',
      timestamp: '2026-10-29T00:00:00Z',
      ticket: {
        title: 'User profile update',
        description: 'Users can update their name and email in Settings.',
        applicationUrl: 'http://localhost:3000',
        environment: 'local development'
      },
      authorizedOrigin: 'http://localhost:3000',
      results: [
        {
          scenario: {
            id: 'TC-01',
            category: 'Acceptance',
            name: 'Verify valid profile update',
            acceptanceCriterion: 'Valid changes are saved.',
            steps: ['Step 1', 'Step 2'],
            expectedOutcome: 'Profile is saved'
          },
          status: 'Passed',
          reproduction: {
            classification: 'Passed',
            consistencyRate: '100% Passed',
            rationale: 'Passed'
          }
        },
        {
          scenario: {
            id: 'TC-02',
            category: 'Validation',
            name: 'Verify invalid email rejection',
            acceptanceCriterion: 'Invalid emails are rejected.',
            testType: 'invalid_email',
            steps: ['Navigate', 'Enter bad email', 'Click save'],
            expectedOutcome: 'Rejection error displayed'
          },
          status: 'Failed',
          reproduction: {
            classification: 'Confirmed',
            consistencyRate: '3 of 3 attempts failed (100% reproducible)',
            rationale: 'Deterministic failure',
            evidence: {
              actual: 'Invalid email was saved without error',
              screenshot: { relativePath: 'screenshots/TC-02_failure.png' },
              consoleErrors: ['API 400 not returned'],
              networkErrors: []
            }
          }
        }
      ]
    };

    const { markdown, summary } = generator.generate(reportContext);

    assert.ok(markdown.includes('# BugHunt AI Test Execution & Defect Report'));
    assert.ok(markdown.includes('User profile update'));
    assert.ok(markdown.includes('| **2** | **1** | **1** | **0** | **0** | **0** |'));
    assert.ok(markdown.includes('### [BUG-01] Verify invalid email rejection'));
    assert.ok(markdown.includes('![BUG-01 Screenshot](screenshots/TC-02_failure.png)'));
    assert.ok(markdown.includes('3 of 3 attempts failed (100% reproducible)'));
    assert.ok(markdown.includes('Scope Enforcement'));

    // Check summary JSON
    assert.strictEqual(summary.counts.total, 2);
    assert.strictEqual(summary.counts.passed, 1);
    assert.strictEqual(summary.counts.confirmed, 1);
  });

  test('prevents fabricated findings when all tests pass', () => {
    const reportContext = {
      runId: 'run-clean-pass',
      timestamp: '2026-10-29T00:00:00Z',
      ticket: {
        title: 'User profile update',
        description: 'Clean run',
        applicationUrl: 'http://localhost:3000'
      },
      authorizedOrigin: 'http://localhost:3000',
      results: [
        {
          scenario: { id: 'TC-01', category: 'Acceptance', name: 'Save details' },
          status: 'Passed',
          reproduction: { classification: 'Passed', consistencyRate: '100%' }
        }
      ]
    };

    const { markdown, summary } = generator.generate(reportContext);
    assert.strictEqual(summary.counts.confirmed, 0);
    assert.strictEqual(summary.counts.suspected, 0);
    assert.ok(markdown.includes('*No defects detected. All scenarios passed.*'));
    assert.ok(!markdown.includes('### [BUG-'));
  });
});
