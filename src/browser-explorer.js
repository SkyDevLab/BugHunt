/**
 * Browser Explorer for BugHunt AI
 * Playwright automation layer for application discovery, scope enforcement, and assertion execution.
 */

const { chromium } = require('playwright');
const { ScopeGuard } = require('./scope-guard');

class BrowserExplorer {
  constructor(options = {}) {
    this.headless = options.headless !== undefined ? options.headless : true;
    this.scopeGuard = options.scopeGuard;
    this.browser = null;
    this.context = null;
  }

  async init() {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: this.headless
      });
    }
    this.context = await this.browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    return this;
  }

  /**
   * Attaches network and console monitoring to a page.
   */
  _attachMonitors(page, telemetry) {
    page.on('console', msg => {
      if (msg.type() === 'error') {
        telemetry.consoleErrors.push(msg.text());
      }
    });

    page.on('requestfailed', request => {
      telemetry.networkErrors.push({
        url: request.url(),
        failureText: request.failure()?.errorText || 'Unknown request failure'
      });
    });

    page.on('response', response => {
      if (response.status() >= 400) {
        telemetry.networkErrors.push({
          url: response.url(),
          status: response.status(),
          statusText: response.statusText()
        });
      }
    });
  }

  /**
   * Explores page structure and discovers accessible controls.
   */
  async explorePage(targetUrl) {
    if (this.scopeGuard) {
      const scopeCheck = this.scopeGuard.isAllowedUrl(targetUrl);
      if (!scopeCheck.allowed) {
        throw new Error(`[ScopeViolation] Navigation blocked: ${scopeCheck.reason}`);
      }
    }

    const page = await this.context.newPage();
    const telemetry = { consoleErrors: [], networkErrors: [] };
    this._attachMonitors(page, telemetry);

    try {
      const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
      if (!response || !response.ok()) {
        const status = response ? response.status() : 'NO_RESPONSE';
        return {
          accessible: false,
          status,
          error: `Page responded with status ${status}`,
          telemetry
        };
      }

      // Discover elements by accessible roles
      const title = await page.title();
      const headings = await page.$$eval('h1, h2, h3', els => els.map(e => e.textContent.trim()));
      const inputs = await page.$$eval('input, textarea, select', els => els.map(e => ({
        tag: e.tagName.toLowerCase(),
        type: e.type,
        id: e.id,
        name: e.name,
        placeholder: e.placeholder,
        value: e.value
      })));
      const buttons = await page.$$eval('button, input[type="submit"]', els => els.map(e => ({
        text: e.textContent.trim() || e.value,
        id: e.id,
        type: e.type
      })));

      return {
        accessible: true,
        title,
        headings,
        inputs,
        buttons,
        telemetry
      };
    } catch (err) {
      return {
        accessible: false,
        error: err.message,
        telemetry
      };
    } finally {
      await page.close();
    }
  }

  /**
   * Executes a single test scenario against the application.
   */
  async executeScenario(scenario, evidenceManager) {
    if (this.scopeGuard) {
      const check = this.scopeGuard.isAllowedUrl(scenario.targetUrl);
      if (!check.allowed) {
        return {
          scenarioId: scenario.id,
          status: 'Blocked',
          reason: `Navigation blocked by ScopeGuard: ${check.reason}`,
          evidence: null
        };
      }
    }

    const page = await this.context.newPage();
    const telemetry = { consoleErrors: [], networkErrors: [] };
    this._attachMonitors(page, telemetry);

    let lastAction = 'Initial navigation';
    let stepNumber = 1;

    try {
      // Step 1: Navigate to target URL
      lastAction = `Navigate to ${scenario.targetUrl}`;
      const navResponse = await page.goto(scenario.targetUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
      if (!navResponse || !navResponse.ok()) {
        const status = navResponse ? navResponse.status() : 'NO_RESPONSE';
        const screenshot = await evidenceManager.captureScreenshot(page, {
          scenarioId: scenario.id,
          stepNumber: 1,
          tag: 'navigation_failure'
        });
        return {
          scenarioId: scenario.id,
          status: 'Blocked',
          reason: `Application unreachable or returned HTTP ${status}`,
          telemetry,
          evidence: evidenceManager.recordFailure({
            scenarioId: scenario.id,
            stepNumber: 1,
            screenshot,
            targetUrl: scenario.targetUrl,
            lastAction,
            expected: 'Application loads successfully with HTTP 200',
            actual: `Page navigation returned status ${status}`,
            consoleErrors: telemetry.consoleErrors,
            networkErrors: telemetry.networkErrors
          })
        };
      }

      // Execute scenario based on testType
      if (scenario.testType === 'happy_path') {
        stepNumber = 2;
        lastAction = 'Fill valid profile fields (Full Name and Email)';
        await page.fill('input[name="fullName"], #fullName', scenario.inputs.fullName);
        await page.fill('input[name="email"], #email', scenario.inputs.email);

        stepNumber = 3;
        lastAction = 'Click Save Changes button';
        await page.click('button[type="submit"], #saveBtn');
        await page.waitForTimeout(300);

        stepNumber = 4;
        lastAction = 'Verify confirmation alert and profile state display';
        const alertEl = await page.$('#alertBox, .alert-success, [role="alert"]');
        const alertText = alertEl ? (await alertEl.textContent()).trim() : '';
        const isSuccessAlert = alertText.toLowerCase().includes('success');

        const savedName = await page.$eval('#displayFullName', el => el.textContent.trim()).catch(() => '');
        const savedEmail = await page.$eval('#displayEmail', el => el.textContent.trim()).catch(() => '');

        const passed = isSuccessAlert && savedName === scenario.inputs.fullName && savedEmail === scenario.inputs.email;

        if (!passed) {
          const screenshot = await evidenceManager.captureScreenshot(page, {
            scenarioId: scenario.id,
            stepNumber,
            tag: 'happy_path_failure'
          });
          return {
            scenarioId: scenario.id,
            status: 'Failed',
            reason: `Expected valid changes to save successfully. Alert: "${alertText}", Saved: "${savedName}", "${savedEmail}"`,
            telemetry,
            evidence: evidenceManager.recordFailure({
              scenarioId: scenario.id,
              stepNumber,
              screenshot,
              targetUrl: page.url(),
              lastAction,
              expected: scenario.expectedOutcome,
              actual: `Profile was not confirmed saved. Alert text: "${alertText}". Display state: Name="${savedName}", Email="${savedEmail}"`,
              consoleErrors: telemetry.consoleErrors,
              networkErrors: telemetry.networkErrors
            })
          };
        }

        return { scenarioId: scenario.id, status: 'Passed', telemetry };
      }

      if (scenario.testType === 'invalid_email') {
        stepNumber = 2;
        lastAction = 'Enter valid name and malformed email';
        await page.fill('input[name="fullName"], #fullName', scenario.inputs.fullName);
        await page.fill('input[name="email"], #email', scenario.inputs.email);

        stepNumber = 3;
        lastAction = 'Click Save Changes with invalid email';
        await page.click('button[type="submit"], #saveBtn');
        await page.waitForTimeout(300);

        stepNumber = 4;
        lastAction = 'Verify invalid email is rejected and validation error is shown';
        const emailErrorEl = await page.$('#emailError');
        const errorText = emailErrorEl ? (await emailErrorEl.textContent()).trim() : '';
        const alertText = await page.$eval('#alertBox', el => el.textContent.trim()).catch(() => '');
        const displayEmail = await page.$eval('#displayEmail', el => el.textContent.trim()).catch(() => '');

        // Defect occurs if:
        // 1. Success alert is shown, OR
        // 2. The invalid email got saved into displayEmail, OR
        // 3. No validation error message was rendered
        const invalidEmailAccepted = alertText.toLowerCase().includes('success') || 
                                     displayEmail === scenario.inputs.email || 
                                     !errorText;

        if (invalidEmailAccepted) {
          const screenshot = await evidenceManager.captureScreenshot(page, {
            scenarioId: scenario.id,
            stepNumber,
            tag: 'invalid_email_accepted'
          });
          return {
            scenarioId: scenario.id,
            status: 'Failed',
            reason: 'Invalid email was accepted by the application without rejecting with validation error.',
            telemetry,
            evidence: evidenceManager.recordFailure({
              scenarioId: scenario.id,
              stepNumber,
              screenshot,
              targetUrl: page.url(),
              lastAction,
              expected: scenario.expectedOutcome,
              actual: `Malformed email "${scenario.inputs.email}" was accepted! Alert: "${alertText}", Saved Email: "${displayEmail}", Error message: "${errorText}"`,
              consoleErrors: telemetry.consoleErrors,
              networkErrors: telemetry.networkErrors
            })
          };
        }

        return { scenarioId: scenario.id, status: 'Passed', telemetry };
      }

      if (scenario.testType === 'empty_name') {
        stepNumber = 2;
        lastAction = 'Clear Full Name field and provide email';
        await page.fill('input[name="fullName"], #fullName', '');
        await page.fill('input[name="email"], #email', scenario.inputs.email);

        stepNumber = 3;
        lastAction = 'Click Save Changes with blank Full Name';
        await page.click('button[type="submit"], #saveBtn');
        await page.waitForTimeout(300);

        stepNumber = 4;
        lastAction = 'Verify required field error is shown';
        const nameErrorEl = await page.$('#fullNameError');
        const errorText = nameErrorEl ? (await nameErrorEl.textContent()).trim() : '';
        const alertText = await page.$eval('#alertBox', el => el.textContent.trim()).catch(() => '');

        const emptyNameAccepted = alertText.toLowerCase().includes('success') || !errorText;

        if (emptyNameAccepted) {
          const screenshot = await evidenceManager.captureScreenshot(page, {
            scenarioId: scenario.id,
            stepNumber,
            tag: 'empty_name_accepted'
          });
          return {
            scenarioId: scenario.id,
            status: 'Failed',
            reason: 'Empty full name was accepted without validation.',
            telemetry,
            evidence: evidenceManager.recordFailure({
              scenarioId: scenario.id,
              stepNumber,
              screenshot,
              targetUrl: page.url(),
              lastAction,
              expected: scenario.expectedOutcome,
              actual: `Empty full name was submitted without required field validation. Alert: "${alertText}", Error text: "${errorText}"`,
              consoleErrors: telemetry.consoleErrors,
              networkErrors: telemetry.networkErrors
            })
          };
        }

        return { scenarioId: scenario.id, status: 'Passed', telemetry };
      }

      if (scenario.testType === 'persistence_refresh') {
        stepNumber = 2;
        lastAction = 'Fill updated name and email';
        await page.fill('input[name="fullName"], #fullName', scenario.inputs.fullName);
        await page.fill('input[name="email"], #email', scenario.inputs.email);

        stepNumber = 3;
        lastAction = 'Click Save Changes and wait for update';
        await page.click('button[type="submit"], #saveBtn');
        await page.waitForTimeout(300);

        stepNumber = 4;
        lastAction = 'Refresh the browser page to test persistence';
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(400);

        stepNumber = 5;
        lastAction = 'Check whether updated profile persists after reload';
        const reloadedName = await page.$eval('input[name="fullName"], #fullName', el => el.value).catch(() => '');
        const reloadedEmail = await page.$eval('input[name="email"], #email', el => el.value).catch(() => '');
        const displayEmail = await page.$eval('#displayEmail', el => el.textContent.trim()).catch(() => '');

        const persists = (reloadedName === scenario.inputs.fullName || displayEmail === scenario.inputs.email);

        if (!persists) {
          const screenshot = await evidenceManager.captureScreenshot(page, {
            scenarioId: scenario.id,
            stepNumber,
            tag: 'persistence_failed_refresh'
          });
          return {
            scenarioId: scenario.id,
            status: 'Failed',
            reason: 'Profile updates did not persist across page refresh and reverted to default initial state.',
            telemetry,
            evidence: evidenceManager.recordFailure({
              scenarioId: scenario.id,
              stepNumber,
              screenshot,
              targetUrl: page.url(),
              lastAction,
              expected: scenario.expectedOutcome,
              actual: `After refreshing the page, input values reverted! Found name="${reloadedName}", email="${reloadedEmail}" (expected "${scenario.inputs.fullName}", "${scenario.inputs.email}")`,
              consoleErrors: telemetry.consoleErrors,
              networkErrors: telemetry.networkErrors
            })
          };
        }

        return { scenarioId: scenario.id, status: 'Passed', telemetry };
      }

      if (scenario.testType === 'api_failure') {
        stepNumber = 2;
        lastAction = 'Configure simulate API failure checkbox';
        const checkbox = await page.$('#simulateApiFailure');
        if (checkbox) {
          await checkbox.check();
        }

        stepNumber = 3;
        lastAction = 'Submit form triggering API failure';
        await page.click('button[type="submit"], #saveBtn');
        await page.waitForTimeout(500);

        stepNumber = 4;
        lastAction = 'Verify visible error notification is displayed';
        const alertEl = await page.$('#alertBox, .alert-error, [role="alert"]');
        const isHidden = alertEl ? await alertEl.evaluate(el => el.classList.contains('hidden') || el.style.display === 'none') : true;
        const alertText = alertEl ? (await alertEl.textContent()).trim() : '';

        const hasAppropriateError = !isHidden && alertText.length > 0 && /error|failed|unable/i.test(alertText);

        if (!hasAppropriateError) {
          const screenshot = await evidenceManager.captureScreenshot(page, {
            scenarioId: scenario.id,
            stepNumber,
            tag: 'api_failure_unhandled'
          });
          return {
            scenarioId: scenario.id,
            status: 'Failed',
            reason: 'API failure occurred but no appropriate error message or notification was displayed to user.',
            telemetry,
            evidence: evidenceManager.recordFailure({
              scenarioId: scenario.id,
              stepNumber,
              screenshot,
              targetUrl: page.url(),
              lastAction,
              expected: scenario.expectedOutcome,
              actual: `Server error was not handled gracefully on UI. Alert hidden: ${isHidden}. Alert text: "${alertText}".`,
              consoleErrors: telemetry.consoleErrors,
              networkErrors: telemetry.networkErrors
            })
          };
        }

        return { scenarioId: scenario.id, status: 'Passed', telemetry };
      }

      // Default fallback
      return { scenarioId: scenario.id, status: 'Passed', telemetry };
    } catch (err) {
      const screenshot = await evidenceManager.captureScreenshot(page, {
        scenarioId: scenario.id,
        stepNumber,
        tag: 'execution_exception'
      });
      const isTimeout = err.name === 'TimeoutError' || err.message.toLowerCase().includes('timeout');
      return {
        scenarioId: scenario.id,
        status: isTimeout ? 'Blocked' : 'Failed',
        reason: err.message,
        telemetry,
        evidence: evidenceManager.recordFailure({
          scenarioId: scenario.id,
          stepNumber,
          screenshot,
          targetUrl: page.url(),
          lastAction,
          expected: scenario.expectedOutcome,
          actual: `Execution exception: ${err.message}`,
          consoleErrors: telemetry.consoleErrors,
          networkErrors: telemetry.networkErrors
        })
      };
    } finally {
      await page.close();
    }
  }

  async close() {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

module.exports = { BrowserExplorer };
