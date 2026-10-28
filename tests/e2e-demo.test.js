const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { createDemoServer } = require('../fixtures/demo-app/server');
const { runBugHunt } = require('../src/runner');

describe('End-to-End BugHunt QA Verification', () => {
  const TEST_PORT = 3999;
  const sampleTicket = path.resolve(__dirname, '../examples/sample-ticket.md');
  let currentServer = null;

  function startServer(fixed = false) {
    return new Promise((resolve, reject) => {
      const server = createDemoServer({ fixed });
      server.listen(TEST_PORT, () => {
        currentServer = server;
        resolve(server);
      });
      server.on('error', reject);
    });
  }

  function stopServer() {
    return new Promise((resolve) => {
      if (currentServer) {
        currentServer.close(() => {
          currentServer = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  after(async () => {
    await stopServer();
  });

  test('detects deliberate defects in demo application and captures real screenshot evidence', async () => {
    await startServer(false); // Buggy mode

    const result = await runBugHunt(sampleTicket, {
      url: `http://localhost:${TEST_PORT}`,
      headless: true,
      reproduceRuns: 2
    });

    assert.ok(result.summary.counts.total >= 4);
    assert.ok(result.summary.counts.confirmed >= 1, 'Must detect at least 1 confirmed deliberate defect');
    assert.ok(fs.existsSync(result.reportPath), 'report.md must exist on disk');
    assert.ok(fs.existsSync(result.summaryPath), 'summary.json must exist on disk');

    // Verify screenshot artifacts exist
    const screenshotsDir = path.join(result.runDir, 'screenshots');
    assert.ok(fs.existsSync(screenshotsDir));
    const screenshots = fs.readdirSync(screenshotsDir);
    assert.ok(screenshots.length > 0, 'Screenshot evidence must be captured on disk');
    screenshots.forEach(file => {
      const stat = fs.statSync(path.join(screenshotsDir, file));
      assert.ok(stat.size > 0, `Screenshot ${file} must have non-zero file size`);
    });

    await stopServer();
  });

  test('verifies all scenarios pass when demo application is in fixed mode', async () => {
    await startServer(true); // Fixed mode

    const result = await runBugHunt(sampleTicket, {
      url: `http://localhost:${TEST_PORT}`,
      headless: true,
      reproduceRuns: 2
    });

    assert.ok(result.summary.counts.total >= 4);
    assert.strictEqual(result.summary.counts.confirmed, 0, 'Must have 0 confirmed defects in fixed mode');
    assert.strictEqual(result.summary.counts.suspected, 0, 'Must have 0 suspected defects in fixed mode');
    assert.strictEqual(result.summary.counts.blocked, 0, 'Must have 0 blocked tests');
    assert.strictEqual(result.summary.counts.passed, result.summary.counts.total, 'All scenarios must pass in fixed mode');

    await stopServer();
  });
});
