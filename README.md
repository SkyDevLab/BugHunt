# BugHunt AI 🎯

> **Autonomous Ticket-to-Bug QA Agent Plugin for Google Antigravity**  
> *Developed by [SkyDevLab](https://github.com/SkyDevLab)*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](package.json)
[![Playwright](https://img.shields.io/badge/Playwright-Chromium-orange.svg)](https://playwright.dev)
[![Antigravity Plugin](https://img.shields.io/badge/Antigravity-Plugin%20v1-purple.svg)](plugin.json)

**BugHunt AI** bridges the gap between issue tickets and verifiable bug reports. Simply paste a Jira or Azure DevOps user story or defect ticket into Google Antigravity, and BugHunt AI autonomously parses requirements, maps acceptance criteria to risk-based test scenarios, drives browser interactions using Playwright, collects live screenshot and telemetry evidence, investigates failure reproducibility, and delivers actionable, developer-ready Markdown defect reports.

---

## ⚡ The Ticket-to-Bug Workflow

```
┌─────────────────┐       ┌──────────────────────┐       ┌────────────────────────┐
│   User Ticket   │ ────> │   Test Plan Engine   │ ────> │  Browser Exploration   │
│  (Jira / ADO)   │       │ (ACs + Boundaries)   │       │ (Accessible Selectors) │
└─────────────────┘       └──────────────────────┘       └───────────┬────────────┘
                                                                     │
┌─────────────────┐       ┌──────────────────────┐       ┌───────────▼────────────┐
│   Bug Report    │ <──── │ Multi-Pass Reproduce │ <──── │   Evidence Capture     │
│  (Markdown+JSON)│       │(Confirmed/Suspected) │       │(Screenshots + Traces)  │
└─────────────────┘       └──────────────────────┘       └────────────────────────┘
```

1. **Ticket Parsing**: Ingests title, description, URL, and acceptance criteria from Markdown, Jira, ADO, or natural language prompts.
2. **Risk-Based Planning**: Derives positive acceptance paths, negative validations (e.g. malformed emails), boundary conditions (blank required fields), persistence checks, and API error resilience.
3. **Browser Exploration**: Uses Playwright with accessible roles and stable selectors to test the running application within an authorized origin scope.
4. **Evidence Collection**: Captures full-page screenshots at the exact instant an assertion fails, while recording console logs and network errors.
5. **Multi-Pass Reproduction**: Reruns candidate failures across multiple iterations to deterministically distinguish **Confirmed** bugs from intermittent **Suspected** flakes.
6. **Report Generation**: Produces a structured Markdown bug report with reproduction steps, expected vs. actual outcomes, and embedded relative screenshot links.

---

## 📦 Antigravity Plugin Architecture

BugHunt AI is authored natively according to the official **Google Antigravity Plugin Specification**:

```
BugHunt/
├── plugin.json                 # Native Antigravity Plugin Manifest
├── package.json                # Project dependencies and test scripts
├── LICENSE                     # MIT Open Source License
├── README.md                   # Installation & usage documentation
├── CONTRIBUTING.md             # Developer contribution guidelines
├── rules/
│   └── AGENTS.md               # Safety & non-fabrication rules for the agent
├── skills/
│   └── ticket-qa/
│       └── SKILL.md            # Step-by-step procedural runbook for Antigravity
├── templates/
│   └── bug-report.md           # Standardized markdown report template
├── examples/
│   └── sample-ticket.md        # Reference test ticket
├── fixtures/
│   └── demo-app/               # Standalone test application with deliberate defects
│       ├── index.html
│       ├── styles.css
│       ├── app.js
│       └── server.js
├── src/
│   ├── ticket-parser.js        # Jira / ADO / text ticket parsing
│   ├── scope-guard.js          # URL scoping, prompt injection defense, log redaction
│   ├── test-planner.js         # Risk-based test scenario generator
│   ├── browser-explorer.js     # Playwright automation & assertion layer
│   ├── evidence-manager.js     # Artifact directories & screenshot capture
│   ├── reproducer.js           # Multi-pass failure consistency classifier
│   ├── report-generator.js     # Markdown defect report & JSON summary generator
│   ├── runner.js               # Orchestrator
│   └── index.js                # Public API
├── scripts/
│   ├── run-tests.js            # Standalone CLI execution script
│   ├── report.js               # Report viewer utility
│   └── demo.js                 # Complete end-to-end demo script
└── tests/                      # Automated unit, integration & browser tests
```

### Manifest (`plugin.json`)
```json
{
  "$schema": "https://antigravity.google/schemas/v1/plugin.json",
  "name": "bughunt-ai",
  "displayName": "BugHunt AI",
  "version": "1.0.0",
  "description": "Ticket-to-Bug autonomous QA Agent for Antigravity. Interprets Jira/ADO tickets, explores web apps with Playwright, captures screenshot evidence, reproduces defects, and generates actionable bug reports.",
  "suggestedPrompts": [
    "Use BugHunt AI to test this ticket: User profile update at http://localhost:3000",
    "Run exploratory QA and verify acceptance criteria for our login form",
    "Reproduce suspected bug and generate evidence report with Playwright"
  ]
}
```

---

## 🛠 Prerequisites

- **Node.js**: `v18.0.0` or later (tested on `v20.11.0`)
- **npm**: `v9.0.0` or later
- **Operating System**: Windows, macOS, or Linux
- **Playwright Chromium**: installed via `npx playwright install chromium`

---

## 🚀 Installation Guide

### Option A: Workspace Installation (Project-Specific)
To enable BugHunt AI for a specific project:
1. Clone the plugin into your repository's `.agents/plugins/` directory:
   ```bash
   mkdir -p .agents/plugins
   git clone https://github.com/SkyDevLab/BugHunt.git .agents/plugins/bughunt-ai
   cd .agents/plugins/bughunt-ai
   npm install
   npx playwright install chromium
   ```
2. Restart Antigravity or reopen the workspace folder. Antigravity will automatically detect `bughunt-ai` and load its `ticket-qa` skill.

### Option B: Global Machine Installation
To make BugHunt AI available across all workspaces on your machine:
1. Clone the plugin into your global Antigravity plugins directory:
   - **Linux / macOS**: `~/.gemini/config/plugins/bughunt-ai`
   - **Windows**: `%USERPROFILE%\.gemini\config\plugins\bughunt-ai`
   ```bash
   git clone https://github.com/SkyDevLab/BugHunt.git "$HOME/.gemini/config/plugins/bughunt-ai"
   cd "$HOME/.gemini/config/plugins/bughunt-ai"
   npm install
   npx playwright install chromium
   ```
2. Restart Antigravity to discover the new global plugin.

---

## 💬 Using BugHunt AI in Antigravity Chat

Once installed, simply prompt Antigravity:

```text
Use BugHunt AI to test this ticket:

Title: User profile update
Description: Users can update their name and email in Settings.

Acceptance criteria:
- Valid changes are saved.
- Invalid emails are rejected.
- Changes persist after refreshing.
- API failures display an appropriate error.

Application URL: http://localhost:3000
Test environment: local development
```

Antigravity will invoke the `ticket-qa` skill, run the Playwright browser tests, reproduce any failures, and respond with an executive summary and the path to the generated `report.md` with screenshot evidence.

---

## 💻 CLI Usage

BugHunt AI can also be run standalone from your terminal or CI/CD pipelines without launching the IDE:

```bash
# Run against a ticket file
node scripts/run-tests.js examples/sample-ticket.md

# Override target application URL
node scripts/run-tests.js examples/sample-ticket.md --url http://localhost:3000

# Run in headful browser mode for visual inspection
node scripts/run-tests.js examples/sample-ticket.md --headful

# Configure reproduction iterations (e.g., 3 retries)
node scripts/run-tests.js examples/sample-ticket.md --reproduce-runs 3
```

---

## 🧪 Demo Application & Verification

BugHunt AI includes a standalone fixture application in `fixtures/demo-app/` with deliberately introduced defects to demonstrate autonomous defect detection.

### 1. Run the One-Command Demo
```bash
npm run demo
```

The script automatically executes:
1. **Phase 1 (Defect Mode)**: Starts the demo app with 3 deliberate bugs:
   - Malformed emails are accepted without validation.
   - Profile changes revert on page refresh (persistence failure).
   - Server 500 error fails silently without displaying an error alert.
   - *Result*: BugHunt detects all 3 defects, executes 3 reproduction runs per defect (100% consistency), captures screenshots on disk, and writes `report.md`.
2. **Phase 2 (Fixed Mode)**: Restarts the demo app in `--fixed` mode:
   - Input validation active, persistence enabled, error alerts displayed.
   - *Result*: BugHunt verifies regression resolution; all 4 scenarios pass (100% pass rate).

### 2. Manual Demo Inspection
To run the demo app server manually:
```bash
# Run with deliberate defects:
npm run start:demo

# Or run in fixed mode:
npm run start:demo:fixed
```
Then visit `http://localhost:3000` in your browser.

---

## 📊 Example Bug Report Output

Below is an excerpt from a live report generated by BugHunt AI:

```markdown
# BugHunt AI Test Execution & Defect Report

| Total Scenarios | Passed | Confirmed Defects | Suspected Issues | Blocked | Untested |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **4** | **1** | **3** | **0** | **0** | **0** |

### [BUG-01] Verify malformed email addresses are rejected with validation error
- **Scenario ID**: `TC-02`
- **Acceptance Criterion**: Invalid emails are rejected.
- **Severity**: **Major** — *Input validation defect: Malformed email addresses are saved without validation.*
- **Status**: **Confirmed**
- **Consistency**: 3 of 3 attempts failed (100% reproducible)

#### Reproduction Steps
1. Navigate to http://localhost:3000.
2. Enter a valid full name.
3. Enter a malformed email without domain ("invalid-user-format").
4. Click the "Save Changes" button.
5. Check for visible validation error message.

#### Expected Result
Form submission is rejected; a visible email validation error is displayed; invalid email is not saved.

#### Actual Result
Malformed email "invalid-user-format" was accepted! Alert: "Profile updated successfully!", Saved Email: "invalid-user-format"

#### Screenshot Evidence
![BUG-01 Screenshot](screenshots/TC-02_step-4_invalid_email_accepted.png)
```

---

## 🛡️ Defect Classification System

BugHunt AI categorizes every scenario outcome according to strict empirical criteria:

| Classification | Definition |
| :--- | :--- |
| **Passed** | All assertions passed cleanly on initial run. |
| **Confirmed** | Defect reproduced consistently across all multi-pass verification attempts (100% deterministic failure). |
| **Suspected** | Intermittent failure observed in some but not all re-runs (indicates a potential race condition or network flake). |
| **Blocked** | Execution could not complete because the target host was unreachable, network timed out, or navigation was halted by safety boundaries. |
| **Not Reproduced** | An initial failure did not recur on subsequent re-runs. |

> **Non-Fabrication Guarantee**: BugHunt AI will **never** invent or simulate screenshots, HTTP responses, or defect reports. If a service is offline, scenarios are marked as **Blocked**, never as fabricated bugs.

---

## 🔒 Security & Safety Guardrails

- **ScopeGuard Boundary**: Browser navigation is strictly locked to the user-authorized origin (`protocol://host:port`). Any cross-domain redirect or attempt to probe unauthorized hosts is immediately terminated.
- **Prompt Injection Immunity**: DOM elements and untrusted web contents are sanitized and never interpreted as instruction overrides.
- **Credential Redaction**: Passwords, authorization headers, JWTs, and Bearer tokens are automatically redacted (`[REDACTED]`) from logs, reports, and filenames.
- **Non-Destructive Execution**: BugHunt AI uses synthetic data and detects dangerous button labels (`delete account`, `purge data`, etc.) to prevent destructive operations.

---

## 🧪 Automated Test Suite

BugHunt AI is thoroughly tested using Node's native test runner (`node:test`):

```bash
# Run all 26 automated unit, integration, and browser tests
npm test

# Run unit tests only
npm run test:unit

# Run end-to-end browser tests
npm run test:e2e
```

Test coverage includes:
- Ticket parsing across Markdown, Jira, and Azure DevOps formats
- Acceptance criteria extraction and entity recognition
- URL boundary and origin scope enforcement
- Redaction of credentials and secrets from logs
- Prompt injection defense patterns
- Risk-based test plan generation
- Screenshot artifact management and relative path resolution
- Multi-pass reproduction and consistency classification
- Graceful handling of unreachable/inaccessible applications (zero false positives)
- Full end-to-end Playwright browser execution against buggy and fixed applications

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for local development setup, coding guidelines, and pull request procedures.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) &copy; 2026 [SkyDevLab](https://github.com/SkyDevLab).
