const { test, describe } = require('node:test');
const assert = require('node:assert');
const { runBugHunt } = require('../src/runner');

describe('Handling of Inaccessible Applications', () => {
  test('gracefully handles unreachable application and marks scenarios as Blocked without fabricating findings', async () => {
    // Port 59999 is guaranteed to be inactive locally
    const deadUrl = 'http://127.0.0.1:59999';
    const sampleTicket = `
Title: User profile update
Acceptance criteria:
- Valid changes are saved.
- Invalid emails are rejected.
Application URL: ${deadUrl}
`;

    const result = await runBugHunt(sampleTicket, {
      url: deadUrl,
      headless: true
    });

    assert.strictEqual(result.summary.counts.passed, 0);
    assert.strictEqual(result.summary.counts.confirmed, 0);
    assert.ok(result.summary.counts.blocked > 0);
    assert.ok(result.markdown.includes('Blocked'));
    assert.ok(!result.markdown.includes('### [BUG-'), 'Must not fabricate bug findings for inaccessible service');
  });
});
