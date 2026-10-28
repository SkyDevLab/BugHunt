/**
 * Failure Reproducer for BugHunt AI
 * Performs multi-pass reproduction of candidate failures to distinguish Confirmed defects from Suspected issues.
 */

class FailureReproducer {
  constructor(options = {}) {
    this.maxAttempts = options.maxAttempts || 2; // Default 2 reproduction passes (total 3 runs including initial)
  }

  /**
   * Re-runs a failing scenario to verify reproducibility.
   */
  async verifyReproducibility(scenario, initialResult, browserExplorer, evidenceManager) {
    if (initialResult.status === 'Passed') {
      return {
        scenarioId: scenario.id,
        classification: 'Passed',
        reproductionAttempts: 0,
        reproducedFailures: 0,
        consistencyRate: 'N/A',
        rationale: 'Scenario passed initial execution without errors.',
        evidence: null
      };
    }

    if (initialResult.status === 'Blocked') {
      return {
        scenarioId: scenario.id,
        classification: 'Blocked',
        reproductionAttempts: 1,
        reproducedFailures: 1,
        consistencyRate: '1 of 1 attempt blocked (100%)',
        rationale: `Execution blocked due to environmental or access constraint: ${initialResult.reason}`,
        evidence: initialResult.evidence
      };
    }

    // For candidate failure, perform multi-attempt reproduction
    let failureCount = 1; // Count initial run
    let totalAttempts = 1;
    let latestEvidence = initialResult.evidence;

    for (let i = 0; i < this.maxAttempts; i++) {
      totalAttempts++;
      const retestResult = await browserExplorer.executeScenario(scenario, evidenceManager);
      if (retestResult.status === 'Failed') {
        failureCount++;
        if (retestResult.evidence) {
          latestEvidence = retestResult.evidence;
        }
      }
    }

    const failurePercentage = Math.round((failureCount / totalAttempts) * 100);
    const consistencyRate = `${failureCount} of ${totalAttempts} attempts failed (${failurePercentage}% reproducible)`;

    let classification = 'Confirmed';
    let rationale = '';

    if (failureCount === totalAttempts) {
      classification = 'Confirmed';
      rationale = `Deterministic failure. Defect reproduced consistently across all ${totalAttempts} execution passes.`;
    } else if (failureCount > 1) {
      classification = 'Suspected';
      rationale = `Intermittent failure. Defect observed in ${failureCount} of ${totalAttempts} runs; suspect timing or state race condition.`;
    } else {
      classification = 'Not Reproduced';
      rationale = `Initial failure could not be reproduced in subsequent ${this.maxAttempts} passes. Classified as Not Reproduced.`;
    }

    return {
      scenarioId: scenario.id,
      classification,
      reproductionAttempts: totalAttempts,
      reproducedFailures: failureCount,
      consistencyRate,
      rationale,
      evidence: latestEvidence,
      originalReason: initialResult.reason
    };
  }
}

module.exports = { FailureReproducer };
