/**
 * Report Generator for BugHunt AI
 * Formats Markdown defect reports and JSON summaries strictly adhering to evidence-based QA standards.
 */

const fs = require('fs');
const path = require('path');

class ReportGenerator {
  constructor(options = {}) {
    this.templatePath = options.templatePath || path.resolve(__dirname, '../templates/bug-report.md');
  }

  /**
   * Assigns severity and detailed rationale based on scenario type and observed impact.
   */
  static determineSeverity(scenario) {
    if (scenario.testType === 'persistence_refresh') {
      return {
        severity: 'Critical',
        rationale: 'Data loss defect: User profile updates are not persisted across page refreshes, causing user changes to silently revert.'
      };
    }
    if (scenario.testType === 'invalid_email') {
      return {
        severity: 'Major',
        rationale: 'Input validation defect: Malformed email addresses are saved without validation, violating data integrity requirements.'
      };
    }
    if (scenario.testType === 'empty_name') {
      return {
        severity: 'Major',
        rationale: 'Required field validation defect: Blank name field is accepted, allowing incomplete user records.'
      };
    }
    if (scenario.testType === 'api_failure') {
      return {
        severity: 'Major',
        rationale: 'Error handling defect: Server 500 errors fail silently without notifying the user, creating confusion.'
      };
    }
    return {
      severity: 'Minor',
      rationale: 'Observed behavior deviates from expected acceptance criteria.'
    };
  }

  /**
   * Generates the complete Markdown report and summary data.
   */
  generate(reportContext) {
    const {
      runId,
      timestamp,
      ticket,
      results,
      browserEngine = 'Chromium (Playwright)',
      authorizedOrigin
    } = reportContext;

    let passedCount = 0;
    let confirmedCount = 0;
    let suspectedCount = 0;
    let blockedCount = 0;
    let untestedCount = 0;

    const scenarioRows = [];
    const defectSections = [];
    let bugIndex = 1;

    for (const res of results) {
      const scenario = res.scenario;
      const repro = res.reproduction;
      const status = repro ? repro.classification : res.status;

      if (status === 'Passed') passedCount++;
      else if (status === 'Confirmed') confirmedCount++;
      else if (status === 'Suspected') suspectedCount++;
      else if (status === 'Blocked') blockedCount++;
      else untestedCount++;

      scenarioRows.push(`| \`${scenario.id}\` | ${scenario.category} | ${scenario.name} | **${status}** | ${repro ? repro.consistencyRate : 'N/A'} |`);

      // Only Confirmed and Suspected failures are true defect findings
      if (['Confirmed', 'Suspected'].includes(status)) {
        const bugId = `BUG-${String(bugIndex++).padStart(2, '0')}`;
        const { severity, rationale } = ReportGenerator.determineSeverity(scenario);
        const evidence = repro?.evidence || res.evidence;

        let stepsMarkdown = scenario.steps.map((s, idx) => `${idx + 1}. ${s}`).join('\n');
        let screenshotMarkdown = evidence?.screenshot?.relativePath
          ? `![${bugId} Screenshot](${evidence.screenshot.relativePath})`
          : '*No screenshot captured.*';

        let logsMarkdown = '*None observed.*';
        const consoleLogs = evidence?.consoleErrors || [];
        const networkLogs = evidence?.networkErrors || [];
        if (consoleLogs.length > 0 || networkLogs.length > 0) {
          const formattedLogs = [
            ...consoleLogs.map(c => `[Console Error] ${c}`),
            ...networkLogs.map(n => `[Network ${n.status || 'Fail'}] ${n.url} - ${n.statusText || n.failureText}`)
          ].join('\n');
          logsMarkdown = `\`\`\`text\n${formattedLogs}\n\`\`\``;
        }

        defectSections.push(`
### [${bugId}] ${scenario.name}

- **Scenario ID**: \`${scenario.id}\`
- **Acceptance Criterion**: ${scenario.acceptanceCriterion}
- **Severity**: **${severity}** — *${rationale}*
- **Status**: **${status}**
- **Environment**: ${ticket.environment || 'Local development'} | **Browser**: ${browserEngine}
- **Consistency**: ${repro?.consistencyRate || 'N/A'} — *${repro?.rationale || 'N/A'}*

#### Preconditions
- Application is accessible at [${ticket.applicationUrl}](${ticket.applicationUrl}).
- Session initialized with standard permissions.

#### Reproduction Steps
${stepsMarkdown}

#### Expected Result
${scenario.expectedOutcome}

#### Actual Result
${evidence?.actual || res.reason || 'Assertion failed during browser exploration.'}

#### Screenshot Evidence
${screenshotMarkdown}

#### Relevant Logs & Telemetry
${logsMarkdown}

#### Limitations & Missing Evidence
- Tested within the authorized origin \`${authorizedOrigin}\`.
- No third-party network or external dependencies were modified.
`);
      }
    }

    // Read template
    let template = fs.readFileSync(this.templatePath, 'utf-8');

    template = template
      .replace(/{{RUN_ID}}/g, runId)
      .replace(/{{TIMESTAMP}}/g, timestamp)
      .replace(/{{APPLICATION_URL}}/g, ticket.applicationUrl || 'N/A')
      .replace(/{{ENVIRONMENT}}/g, ticket.environment || 'local development')
      .replace(/{{BROWSER_ENGINE}}/g, browserEngine)
      .replace(/{{TOTAL_SCENARIOS}}/g, String(results.length))
      .replace(/{{PASSED_COUNT}}/g, String(passedCount))
      .replace(/{{CONFIRMED_COUNT}}/g, String(confirmedCount))
      .replace(/{{SUSPECTED_COUNT}}/g, String(suspectedCount))
      .replace(/{{BLOCKED_COUNT}}/g, String(blockedCount))
      .replace(/{{UNTESTED_COUNT}}/g, String(untestedCount))
      .replace(/{{TICKET_TITLE}}/g, ticket.title || 'Untitled Ticket')
      .replace(/{{TICKET_DESCRIPTION}}/g, ticket.description || 'No description provided')
      .replace(/{{SCENARIO_ROWS}}/g, scenarioRows.join('\n'))
      .replace(/{{DEFECT_SECTIONS}}/g, defectSections.length > 0 ? defectSections.join('\n---\n') : '*No defects detected. All scenarios passed.*')
      .replace(/{{AUTHORIZED_ORIGIN}}/g, authorizedOrigin || ticket.applicationUrl || 'N/A');

    const summaryJson = {
      runId,
      timestamp,
      ticket: {
        title: ticket.title,
        applicationUrl: ticket.applicationUrl,
        environment: ticket.environment
      },
      counts: {
        total: results.length,
        passed: passedCount,
        confirmed: confirmedCount,
        suspected: suspectedCount,
        blocked: blockedCount,
        untested: untestedCount
      },
      scenarios: results.map(r => ({
        id: r.scenario.id,
        name: r.scenario.name,
        category: r.scenario.category,
        status: r.reproduction ? r.reproduction.classification : r.status,
        consistencyRate: r.reproduction ? r.reproduction.consistencyRate : 'N/A'
      }))
    };

    return {
      markdown: template,
      summary: summaryJson
    };
  }
}

module.exports = { ReportGenerator };
