/**
 * Evidence Manager for BugHunt AI
 * Manages run directories, captures screenshots at failure points, and stores structured artifacts.
 */

const fs = require('fs');
const path = require('path');
const { ScopeGuard } = require('./scope-guard');

class EvidenceManager {
  constructor(options = {}) {
    this.baseDir = options.baseDir || path.resolve(process.cwd(), 'bughunt-reports');
    const timestamp = options.timestamp || new Date().toISOString().replace(/[:.]/g, '-');
    this.runId = options.runId || `run-${timestamp}`;
    this.runDir = path.join(this.baseDir, this.runId);
    this.screenshotsDir = path.join(this.runDir, 'screenshots');
    this.tracesDir = path.join(this.runDir, 'traces');
    this.logsDir = path.join(this.runDir, 'logs');

    this._ensureDirectories();
    this.recordedFailures = [];
  }

  _ensureDirectories() {
    [this.baseDir, this.runDir, this.screenshotsDir, this.tracesDir, this.logsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Captures a screenshot from the active Playwright page before resetting state.
   */
  async captureScreenshot(page, metadata = {}) {
    if (!page) return null;

    const { scenarioId = 'UNKNOWN', stepNumber = 1, tag = 'evidence' } = metadata;
    const cleanTag = tag.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 30);
    const fileName = `${scenarioId}_step-${stepNumber}_${cleanTag}_${Date.now()}.png`;
    const absolutePath = path.join(this.screenshotsDir, fileName);
    const relativePath = `screenshots/${fileName}`;

    try {
      await page.screenshot({ path: absolutePath, fullPage: true });
      return {
        fileName,
        absolutePath,
        relativePath
      };
    } catch (err) {
      console.warn(`[EvidenceManager] Failed to capture screenshot: ${err.message}`);
      return null;
    }
  }

  /**
   * Records failure evidence metadata.
   */
  recordFailure(evidence) {
    const sanitizedEvidence = {
      ...evidence,
      consoleErrors: (evidence.consoleErrors || []).map(ScopeGuard.sanitizeLogs),
      networkErrors: (evidence.networkErrors || []).map(err => ({
        url: ScopeGuard.sanitizeLogs(err.url),
        status: err.status,
        statusText: err.statusText,
        failureText: ScopeGuard.sanitizeLogs(err.failureText)
      })),
      timestamp: evidence.timestamp || new Date().toISOString()
    };
    this.recordedFailures.push(sanitizedEvidence);
    return sanitizedEvidence;
  }

  /**
   * Saves summary.json artifact.
   */
  saveSummary(summaryData) {
    const summaryFile = path.join(this.runDir, 'summary.json');
    fs.writeFileSync(summaryFile, JSON.stringify(summaryData, null, 2), 'utf-8');
    return summaryFile;
  }

  /**
   * Saves report.md artifact.
   */
  saveReport(markdownContent) {
    const reportFile = path.join(this.runDir, 'report.md');
    fs.writeFileSync(reportFile, markdownContent, 'utf-8');
    return reportFile;
  }

  getPaths() {
    return {
      runId: this.runId,
      runDir: this.runDir,
      screenshotsDir: this.screenshotsDir,
      tracesDir: this.tracesDir,
      logsDir: this.logsDir,
      reportPath: path.join(this.runDir, 'report.md'),
      summaryPath: path.join(this.runDir, 'summary.json')
    };
  }
}

module.exports = { EvidenceManager };
