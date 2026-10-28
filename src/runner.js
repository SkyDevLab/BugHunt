/**
 * Test Runner Orchestrator for BugHunt AI
 * Executes the full Ticket -> Plan -> Explore -> Assert -> Reproduce -> Report QA workflow.
 */

const fs = require('fs');
const path = require('path');
const { parseTicket } = require('./ticket-parser');
const { ScopeGuard } = require('./scope-guard');
const { generateTestPlan } = require('./test-planner');
const { EvidenceManager } = require('./evidence-manager');
const { BrowserExplorer } = require('./browser-explorer');
const { FailureReproducer } = require('./reproducer');
const { ReportGenerator } = require('./report-generator');

async function runBugHunt(ticketInput, options = {}) {
  // 1. Resolve ticket content
  let ticketText = ticketInput;
  if (typeof ticketInput === 'string' && fs.existsSync(ticketInput)) {
    ticketText = fs.readFileSync(ticketInput, 'utf-8');
  }

  const parsedTicket = parseTicket(ticketText);
  if (options.url) {
    parsedTicket.applicationUrl = options.url;
  }

  if (!parsedTicket.applicationUrl) {
    throw new Error('Application URL is required. Please specify it in the ticket or via --url.');
  }

  // 2. Initialize ScopeGuard
  const scopeGuard = new ScopeGuard(parsedTicket.applicationUrl);

  // 3. Generate risk-based test plan
  const testPlan = generateTestPlan(parsedTicket);

  // 4. Initialize Evidence Manager
  const evidenceManager = new EvidenceManager({
    baseDir: options.outputDir
  });

  // 5. Initialize Browser Explorer
  const explorer = new BrowserExplorer({
    headless: options.headless !== undefined ? options.headless : true,
    scopeGuard
  });

  const reproducer = new FailureReproducer({
    maxAttempts: options.reproduceRuns || 2
  });

  const results = [];
  const timestamp = new Date().toISOString();

  try {
    await explorer.init();

    // 6. Preflight: Check Application Discovery & Reachability
    const discovery = await explorer.explorePage(parsedTicket.applicationUrl);
    if (!discovery.accessible) {
      console.warn(`[BugHunt] Target application is inaccessible at ${parsedTicket.applicationUrl}: ${discovery.error}`);

      // Mark all planned scenarios as Blocked
      for (const scenario of testPlan.scenarios) {
        results.push({
          scenario,
          status: 'Blocked',
          reason: `Target application is not reachable: ${discovery.error}`,
          reproduction: {
            classification: 'Blocked',
            consistencyRate: 'Blocked (Application Unreachable)',
            rationale: `Preflight discovery failed with error: ${discovery.error}`,
            evidence: null
          }
        });
      }
    } else {
      // 7. Execute Scenarios
      for (const scenario of testPlan.scenarios) {
        console.log(`[BugHunt] Running ${scenario.id}: ${scenario.name}...`);
        const initialResult = await explorer.executeScenario(scenario, evidenceManager);

        let reproduction = null;
        if (initialResult.status === 'Failed') {
          console.log(`[BugHunt] ${scenario.id} failed. Investigating reproducibility...`);
          reproduction = await reproducer.verifyReproducibility(scenario, initialResult, explorer, evidenceManager);
          console.log(`[BugHunt] ${scenario.id} classified as: ${reproduction.classification} (${reproduction.consistencyRate})`);
        } else if (initialResult.status === 'Blocked') {
          reproduction = {
            classification: 'Blocked',
            consistencyRate: 'Blocked',
            rationale: initialResult.reason,
            evidence: initialResult.evidence
          };
        } else {
          reproduction = {
            classification: 'Passed',
            consistencyRate: '100% Passed',
            rationale: 'Scenario verified successfully.',
            evidence: null
          };
        }

        results.push({
          scenario,
          status: initialResult.status,
          reason: initialResult.reason,
          initialResult,
          reproduction
        });
      }
    }
  } finally {
    await explorer.close();
  }

  // 8. Generate Reports
  const reportGenerator = new ReportGenerator();
  const { markdown, summary } = reportGenerator.generate({
    runId: evidenceManager.runId,
    timestamp,
    ticket: parsedTicket,
    results,
    authorizedOrigin: scopeGuard.authorizedOrigin
  });

  evidenceManager.saveReport(markdown);
  evidenceManager.saveSummary(summary);

  return {
    runId: evidenceManager.runId,
    runDir: evidenceManager.runDir,
    reportPath: evidenceManager.getPaths().reportPath,
    summaryPath: evidenceManager.getPaths().summaryPath,
    parsedTicket,
    testPlan,
    results,
    summary,
    markdown
  };
}

module.exports = { runBugHunt };
