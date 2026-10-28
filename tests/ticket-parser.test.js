const { test, describe } = require('node:test');
const assert = require('node:assert');
const { parseTicket } = require('../src/ticket-parser');

describe('Ticket Parser', () => {
  test('parses standard Markdown ticket with acceptance criteria and URL', () => {
    const raw = `
# Ticket: User profile update
Title: User profile update
Description: Users can update their name and email in Settings.

Acceptance criteria:
- Valid changes are saved.
- Invalid emails are rejected.
- Changes persist after refreshing.
- API failures display an appropriate error.

Application URL: http://localhost:3000
Test environment: local development
`;

    const result = parseTicket(raw);
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.title, 'User profile update');
    assert.strictEqual(result.applicationUrl, 'http://localhost:3000');
    assert.strictEqual(result.environment, 'local development');
    assert.strictEqual(result.acceptanceCriteria.length, 4);
    assert.ok(result.acceptanceCriteria.includes('Valid changes are saved.'));
    assert.ok(result.acceptanceCriteria.includes('Invalid emails are rejected.'));
    assert.ok(result.acceptanceCriteria.includes('Changes persist after refreshing.'));
    assert.ok(result.acceptanceCriteria.includes('API failures display an appropriate error.'));
  });

  test('parses Jira-style ticket format with Summary and numbered ACs', () => {
    const raw = `
Summary: Authentication login flow
Description: Users should be able to log in with valid credentials.
Conditions of Acceptance:
1. Valid credentials redirect to dashboard
2. Invalid password shows error banner
Target URL: https://staging.example.com:8080/login
Environment: Staging
`;

    const result = parseTicket(raw);
    assert.strictEqual(result.isValid, true);
    assert.strictEqual(result.title, 'Authentication login flow');
    assert.strictEqual(result.applicationUrl, 'https://staging.example.com:8080/login');
    assert.strictEqual(result.environment, 'Staging');
    assert.strictEqual(result.acceptanceCriteria.length, 2);
    assert.strictEqual(result.acceptanceCriteria[0], 'Valid credentials redirect to dashboard');
  });

  test('gracefully handles empty or malformed ticket without throwing', () => {
    const emptyResult = parseTicket('');
    assert.strictEqual(emptyResult.isValid, false);
    assert.ok(emptyResult.errors.length > 0);

    const nullResult = parseTicket(null);
    assert.strictEqual(nullResult.isValid, false);
  });

  test('extracts domain entities mentioned in ticket', () => {
    const raw = `
Title: Reset Profile Settings
Description: Change user name and email.
Acceptance criteria:
- Save new name and email
Application URL: http://localhost:3000
`;
    const result = parseTicket(raw);
    assert.ok(result.entities.includes('name'));
    assert.ok(result.entities.includes('email'));
    assert.ok(result.entities.includes('profile'));
  });
});
