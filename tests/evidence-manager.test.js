const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { EvidenceManager } = require('../src/evidence-manager');

describe('Evidence Manager', () => {
  test('creates structured run directories for artifacts', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bughunt-test-'));
    const manager = new EvidenceManager({ baseDir: tmpDir, runId: 'run-test-123' });

    const paths = manager.getPaths();
    assert.strictEqual(paths.runId, 'run-test-123');
    assert.ok(fs.existsSync(paths.runDir));
    assert.ok(fs.existsSync(paths.screenshotsDir));
    assert.ok(fs.existsSync(paths.tracesDir));
    assert.ok(fs.existsSync(paths.logsDir));

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('records failure evidence with sanitized telemetry', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bughunt-test-'));
    const manager = new EvidenceManager({ baseDir: tmpDir });

    const evidence = manager.recordFailure({
      scenarioId: 'TC-02',
      stepNumber: 3,
      targetUrl: 'http://localhost:3000',
      lastAction: 'Click Save',
      expected: 'Invalid email rejected',
      actual: 'Email was accepted',
      consoleErrors: ['Error: Bearer secret_token_xyz invalid'],
      networkErrors: [{ url: 'http://localhost:3000/api?key=123', status: 500, statusText: 'Server Error' }]
    });

    assert.strictEqual(evidence.scenarioId, 'TC-02');
    assert.ok(!evidence.consoleErrors[0].includes('secret_token_xyz'));
    assert.ok(evidence.consoleErrors[0].includes('[REDACTED_TOKEN]'));

    // Save report and summary
    const reportFile = manager.saveReport('# Test Report');
    const summaryFile = manager.saveSummary({ runId: manager.runId, passed: true });

    assert.ok(fs.existsSync(reportFile));
    assert.ok(fs.existsSync(summaryFile));

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
