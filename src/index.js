/**
 * BugHunt AI Public API
 */

const { parseTicket } = require('./ticket-parser');
const { ScopeGuard } = require('./scope-guard');
const { generateTestPlan } = require('./test-planner');
const { EvidenceManager } = require('./evidence-manager');
const { BrowserExplorer } = require('./browser-explorer');
const { FailureReproducer } = require('./reproducer');
const { ReportGenerator } = require('./report-generator');
const { runBugHunt } = require('./runner');

module.exports = {
  parseTicket,
  ScopeGuard,
  generateTestPlan,
  EvidenceManager,
  BrowserExplorer,
  FailureReproducer,
  ReportGenerator,
  runBugHunt
};
