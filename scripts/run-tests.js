#!/usr/bin/env node

/**
 * BugHunt AI CLI Runner
 * Usage:
 *   node scripts/run-tests.js examples/sample-ticket.md
 *   node scripts/run-tests.js --ticket "Title: ... Description: ..." --url http://localhost:3000
 */

const fs = require('fs');
const path = require('path');
const { runBugHunt } = require('../src/runner');

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
BugHunt AI — Ticket-to-Bug QA Agent for Antigravity

Usage:
  npx bughunt <ticket-path> [options]
  node scripts/run-tests.js <ticket-path> [options]

Options:
  --url <url>              Application URL override (e.g., http://localhost:3000)
  --output <dir>           Output directory for reports (default: ./bughunt-reports)
  --reproduce-runs <num>   Number of additional reproduction passes for failures (default: 2)
  --headful                Run browser in visible mode (default: headless)
  --help, -h               Show this help message

Examples:
  node scripts/run-tests.js examples/sample-ticket.md
  node scripts/run-tests.js examples/sample-ticket.md --url http://localhost:3000
`);
    process.exit(0);
  }

  let ticketInput = null;
  let url = null;
  let outputDir = null;
  let reproduceRuns = 2;
  let headless = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--url' && args[i + 1]) {
      url = args[++i];
    } else if (arg === '--output' && args[i + 1]) {
      outputDir = args[++i];
    } else if (arg === '--reproduce-runs' && args[i + 1]) {
      reproduceRuns = parseInt(args[++i], 10);
    } else if (arg === '--headful') {
      headless = false;
    } else if (!arg.startsWith('--') && !ticketInput) {
      ticketInput = arg;
    }
  }

  if (!ticketInput) {
    console.error('Error: Please provide a ticket file path or ticket text.');
    process.exit(1);
  }

  console.log('=====================================================');
  console.log('  BugHunt AI: Autonomous Ticket-to-Bug QA Agent      ');
  console.log('=====================================================\n');

  try {
    const result = await runBugHunt(ticketInput, {
      url,
      outputDir,
      reproduceRuns,
      headless
    });

    console.log('\n-----------------------------------------------------');
    console.log('  Execution Complete! Summary of Findings:           ');
    console.log('-----------------------------------------------------');
    console.log(`  Total Scenarios    : ${result.summary.counts.total}`);
    console.log(`  Passed             : ${result.summary.counts.passed}`);
    console.log(`  Confirmed Defects  : ${result.summary.counts.confirmed}`);
    console.log(`  Suspected Issues   : ${result.summary.counts.suspected}`);
    console.log(`  Blocked            : ${result.summary.counts.blocked}`);
    console.log(`  Untested           : ${result.summary.counts.untested}`);
    console.log('-----------------------------------------------------');
    console.log(`\nReport generated at : ${result.reportPath}`);
    console.log(`Artifacts directory : ${result.runDir}\n`);

    if (result.summary.counts.confirmed > 0) {
      process.exitCode = 1; // Indicate defects were found
    }
  } catch (err) {
    console.error(`\n[BugHunt Error]: ${err.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
