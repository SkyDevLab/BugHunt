#!/usr/bin/env node

/**
 * Report Viewer / Formatter for BugHunt AI
 * Formats or prints summary results from an existing run directory.
 */

const fs = require('fs');
const path = require('path');

function printSummary(runDirPath) {
  const summaryFile = path.join(runDirPath, 'summary.json');
  if (!fs.existsSync(summaryFile)) {
    console.error(`No summary.json found in ${runDirPath}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(summaryFile, 'utf-8'));
  console.log(`\nBugHunt Run Summary: ${data.runId}`);
  console.log(`Timestamp : ${data.timestamp}`);
  console.log(`Ticket    : ${data.ticket.title} (${data.ticket.applicationUrl})`);
  console.log(`\nResults Breakdown:`);
  console.log(`- Passed            : ${data.counts.passed}`);
  console.log(`- Confirmed Defects : ${data.counts.confirmed}`);
  console.log(`- Suspected Issues  : ${data.counts.suspected}`);
  console.log(`- Blocked           : ${data.counts.blocked}`);
  console.log(`\nScenarios:`);
  data.scenarios.forEach(s => {
    console.log(`  [${s.id}] [${s.status}] ${s.name} (${s.consistencyRate})`);
  });
  console.log(`\nMarkdown Report: ${path.join(runDirPath, 'report.md')}\n`);
}

if (require.main === module) {
  const targetDir = process.argv[2] || './bughunt-reports';
  if (fs.existsSync(path.join(targetDir, 'summary.json'))) {
    printSummary(targetDir);
  } else if (fs.existsSync(targetDir)) {
    // Find most recent run directory
    const entries = fs.readdirSync(targetDir, { withFileTypes: true })
      .filter(e => e.isDirectory() && e.name.startsWith('run-'))
      .map(e => e.name)
      .sort()
      .reverse();
    if (entries.length > 0) {
      printSummary(path.join(targetDir, entries[0]));
    } else {
      console.log(`No runs found in ${targetDir}`);
    }
  } else {
    console.log(`Path ${targetDir} does not exist.`);
  }
}

module.exports = { printSummary };
