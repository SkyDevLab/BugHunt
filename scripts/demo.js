#!/usr/bin/env node

/**
 * End-to-End Demonstration Script for BugHunt AI
 * Demonstrates:
 * 1. Testing buggy demo app -> detects intentional defects, captures screenshot evidence, reproduces consistency.
 * 2. Testing fixed demo app -> verifies all scenarios pass.
 */

const path = require('path');
const fs = require('fs');
const http = require('http');
const { createDemoServer } = require('../fixtures/demo-app/server');
const { runBugHunt } = require('../src/runner');

function waitForServer(port, timeoutMs = 5000) {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      const req = http.get(`http://localhost:${port}/`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else {
          retry();
        }
      });
      req.on('error', () => retry());
      req.end();
    };

    const retry = () => {
      if (Date.now() - startTime > timeoutMs) {
        reject(new Error(`Timed out waiting for server on port ${port}`));
      } else {
        setTimeout(check, 100);
      }
    };

    check();
  });
}

async function runDemo() {
  const DEMO_PORT = 3000;
  const sampleTicketPath = path.resolve(__dirname, '../examples/sample-ticket.md');

  console.log('================================================================');
  console.log('      BugHunt AI: Ticket-to-Bug Autonomous QA Agent Demo        ');
  console.log('================================================================\n');

  // -----------------------------------------------------------
  // PHASE 1: Run against Demo Application with Deliberate Defects
  // -----------------------------------------------------------
  console.log('>>> [PHASE 1] Starting Demo App with Deliberate Defects (Port 3000)...');
  const buggyServer = createDemoServer({ fixed: false });
  await new Promise(resolve => buggyServer.listen(DEMO_PORT, resolve));
  await waitForServer(DEMO_PORT);
  console.log('    Demo App listening at http://localhost:3000 (Defect Mode Active)\n');

  console.log('>>> Executing BugHunt AI against sample ticket...');
  const buggyRun = await runBugHunt(sampleTicketPath, {
    url: `http://localhost:${DEMO_PORT}`,
    headless: true,
    reproduceRuns: 2
  });

  console.log('\n>>> PHASE 1 Completed!');
  console.log(`    Total Scenarios Tested : ${buggyRun.summary.counts.total}`);
  console.log(`    Passed Scenarios       : ${buggyRun.summary.counts.passed}`);
  console.log(`    Confirmed Defects      : ${buggyRun.summary.counts.confirmed}`);
  console.log(`    Suspected Issues       : ${buggyRun.summary.counts.suspected}`);
  console.log(`    Blocked Scenarios      : ${buggyRun.summary.counts.blocked}`);
  console.log(`    Report File            : ${buggyRun.reportPath}`);

  // Verify screenshots captured
  const screenshotsDir = path.join(buggyRun.runDir, 'screenshots');
  const screenshots = fs.existsSync(screenshotsDir) ? fs.readdirSync(screenshotsDir) : [];
  console.log(`    Screenshots Captured   : ${screenshots.length} files`);
  screenshots.forEach(s => console.log(`      * ${s}`));

  await new Promise(resolve => buggyServer.close(resolve));
  console.log('    Buggy Demo App shut down.\n');

  // -----------------------------------------------------------
  // PHASE 2: Run against Demo Application in Fixed Mode
  // -----------------------------------------------------------
  console.log('----------------------------------------------------------------');
  console.log('>>> [PHASE 2] Starting Demo App in FIXED Mode (Port 3000)...');
  const fixedServer = createDemoServer({ fixed: true });
  await new Promise(resolve => fixedServer.listen(DEMO_PORT, resolve));
  await waitForServer(DEMO_PORT);
  console.log('    Demo App listening at http://localhost:3000 (Fixed Mode Active)\n');

  console.log('>>> Re-executing BugHunt AI to verify regression resolution...');
  const fixedRun = await runBugHunt(sampleTicketPath, {
    url: `http://localhost:${DEMO_PORT}`,
    headless: true,
    reproduceRuns: 2
  });

  console.log('\n>>> PHASE 2 Completed!');
  console.log(`    Total Scenarios Tested : ${fixedRun.summary.counts.total}`);
  console.log(`    Passed Scenarios       : ${fixedRun.summary.counts.passed}`);
  console.log(`    Confirmed Defects      : ${fixedRun.summary.counts.confirmed}`);
  console.log(`    Suspected Issues       : ${fixedRun.summary.counts.suspected}`);
  console.log(`    Blocked Scenarios      : ${fixedRun.summary.counts.blocked}`);
  console.log(`    Report File            : ${fixedRun.reportPath}`);

  await new Promise(resolve => fixedServer.close(resolve));
  console.log('    Fixed Demo App shut down.\n');

  console.log('================================================================');
  console.log('               DEMO EXECUTION VERIFICATION SUMMARY              ');
  console.log('================================================================');
  console.log(`  1. Deliberate Defects Detected : ${buggyRun.summary.counts.confirmed > 0 ? 'SUCCESS' : 'FAILED'}`);
  console.log(`  2. Screenshot Evidence Saved   : ${screenshots.length > 0 ? 'SUCCESS' : 'FAILED'}`);
  console.log(`  3. Fixed Mode Full Pass Rate   : ${fixedRun.summary.counts.passed === fixedRun.summary.counts.total ? 'SUCCESS' : 'FAILED'}`);
  console.log('================================================================\n');
}

if (require.main === module) {
  runDemo().catch(err => {
    console.error('Demo execution error:', err);
    process.exit(1);
  });
}

module.exports = { runDemo };
