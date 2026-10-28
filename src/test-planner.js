/**
 * Test Planner for BugHunt AI
 * Generates risk-based test scenarios directly from parsed ticket acceptance criteria.
 */

function generateTestPlan(parsedTicket) {
  const { title, acceptanceCriteria, applicationUrl, entities } = parsedTicket;
  const scenarios = [];
  let counter = 1;

  function createId() {
    return `TC-${String(counter++).padStart(2, '0')}`;
  }

  // Normalize criteria for pattern matching
  const acTexts = acceptanceCriteria.map(ac => ac.toLowerCase());

  // 1. Happy Path / Normal Flow: Valid changes are saved
  const hasSaveAC = acTexts.some(ac => ac.includes('valid') || ac.includes('saved') || ac.includes('update'));
  if (hasSaveAC || acceptanceCriteria.length === 0) {
    scenarios.push({
      id: createId(),
      category: 'Acceptance (Happy Path)',
      name: 'Verify valid profile details are saved and confirmed',
      acceptanceCriterion: acceptanceCriteria.find(ac => ac.toLowerCase().includes('saved') || ac.toLowerCase().includes('valid')) || 'Valid changes are saved.',
      targetUrl: applicationUrl,
      steps: [
        'Navigate to the application URL.',
        'Enter a valid full name (e.g., "Jane Doe").',
        'Enter a valid email address (e.g., "jane.doe@example.com").',
        'Click the "Save Changes" button.',
        'Observe the confirmation alert and profile state.'
      ],
      expectedOutcome: 'Profile is saved successfully, showing a success message and updated profile state.',
      testType: 'happy_path',
      inputs: {
        fullName: 'Jane Doe',
        email: 'jane.doe@example.com'
      }
    });
  }

  // 2. Negative Validation: Invalid email rejection
  const hasEmailValidationAC = acTexts.some(ac => ac.includes('invalid email') || ac.includes('email') && ac.includes('reject'));
  if (hasEmailValidationAC) {
    scenarios.push({
      id: createId(),
      category: 'Negative Validation',
      name: 'Verify malformed email addresses are rejected with validation error',
      acceptanceCriterion: acceptanceCriteria.find(ac => ac.toLowerCase().includes('email') && ac.toLowerCase().includes('reject')) || 'Invalid emails are rejected.',
      targetUrl: applicationUrl,
      steps: [
        'Navigate to the application URL.',
        'Enter a valid full name.',
        'Enter a malformed email without domain (e.g., "invalid-user-format").',
        'Click the "Save Changes" button.',
        'Check for visible validation error message.'
      ],
      expectedOutcome: 'Form submission is halted or rejected; a visible email validation error is displayed; invalid email is not saved.',
      testType: 'invalid_email',
      inputs: {
        fullName: 'Jane Doe',
        email: 'invalid-user-format'
      }
    });
  }

  // 3. Boundary & Field Validation: Required field empty
  const hasRequiredValidation = entities.includes('name') || acTexts.some(ac => ac.includes('required') || ac.includes('empty'));
  if (hasRequiredValidation) {
    scenarios.push({
      id: createId(),
      category: 'Boundary & Form Validation',
      name: 'Verify required full name field cannot be submitted blank',
      acceptanceCriterion: 'Required fields must be validated before submission.',
      targetUrl: applicationUrl,
      steps: [
        'Navigate to the application URL.',
        'Clear the full name input field completely.',
        'Enter a valid email address.',
        'Click the "Save Changes" button.',
        'Check for visible required field error message.'
      ],
      expectedOutcome: 'Form indicates full name is required and rejects empty submission.',
      testType: 'empty_name',
      inputs: {
        fullName: '',
        email: 'jane.doe@example.com'
      }
    });
  }

  // 4. State Persistence: Changes persist after refreshing
  const hasPersistenceAC = acTexts.some(ac => ac.includes('persist') || ac.includes('refresh') || ac.includes('reload'));
  if (hasPersistenceAC) {
    scenarios.push({
      id: createId(),
      category: 'State Persistence',
      name: 'Verify updated profile data persists after page refresh',
      acceptanceCriterion: acceptanceCriteria.find(ac => ac.toLowerCase().includes('persist') || ac.toLowerCase().includes('refresh')) || 'Changes persist after refreshing.',
      targetUrl: applicationUrl,
      steps: [
        'Navigate to the application URL.',
        'Update full name to "Taylor Swift" and email to "taylor@example.com".',
        'Click "Save Changes" and wait for save confirmation.',
        'Refresh / reload the browser page.',
        'Verify that the saved name and email persist on reload.'
      ],
      expectedOutcome: 'Values remain updated ("Taylor Swift", "taylor@example.com") after page reload, rather than reverting to initial state.',
      testType: 'persistence_refresh',
      inputs: {
        fullName: 'Taylor Swift',
        email: 'taylor@example.com'
      }
    });
  }

  // 5. Error Handling: API failure handling
  const hasErrorAC = acTexts.some(ac => ac.includes('error') || ac.includes('api failure') || ac.includes('fail'));
  if (hasErrorAC) {
    scenarios.push({
      id: createId(),
      category: 'Resilience & Error Handling',
      name: 'Verify API 500 failure displays user-friendly error notification',
      acceptanceCriterion: acceptanceCriteria.find(ac => ac.toLowerCase().includes('error') || ac.toLowerCase().includes('failure')) || 'API failures display an appropriate error.',
      targetUrl: applicationUrl,
      steps: [
        'Navigate to the application URL.',
        'Enable simulated API server failure or trigger 500 endpoint.',
        'Click "Save Changes" button.',
        'Observe user interface response and error banner.'
      ],
      expectedOutcome: 'Application displays an appropriate error banner/notification to the user without crashing silently.',
      testType: 'api_failure',
      inputs: {
        fullName: 'Jane Doe',
        email: 'jane.doe@example.com',
        simulateFailure: true
      }
    });
  }

  return {
    ticketTitle: title,
    targetUrl: applicationUrl,
    totalScenarios: scenarios.length,
    scenarios
  };
}

module.exports = { generateTestPlan };
