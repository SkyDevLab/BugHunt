/**
 * Scope Guard for BugHunt AI
 * Enforces URL boundary constraints, prompt injection defenses, and credential sanitization.
 */

const { URL } = require('url');

class ScopeGuard {
  constructor(authorizedUrl) {
    if (!authorizedUrl) {
      throw new Error('Authorized URL is required to initialize ScopeGuard');
    }
    this.authorizedParsed = new URL(authorizedUrl);
    this.authorizedOrigin = this.authorizedParsed.origin;
    this.allowedHosts = new Set([this.authorizedParsed.hostname, 'localhost', '127.0.0.1']);
    this.allowedPort = this.authorizedParsed.port || (this.authorizedParsed.protocol === 'https:' ? '443' : '80');
  }

  /**
   * Validates whether a candidate URL is strictly within authorized scope.
   */
  isAllowedUrl(candidateUrl) {
    try {
      const parsed = new URL(candidateUrl, this.authorizedOrigin);
      // Protocol must be http or https
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { allowed: false, reason: `Disallowed protocol: ${parsed.protocol}` };
      }

      // Check origin
      if (parsed.origin === this.authorizedOrigin) {
        return { allowed: true, reason: 'Exact origin match' };
      }

      // Check localhost equivalence
      const isLocalTarget = ['localhost', '127.0.0.1'].includes(this.authorizedParsed.hostname);
      const isLocalCandidate = ['localhost', '127.0.0.1'].includes(parsed.hostname);
      const candidatePort = parsed.port || (parsed.protocol === 'https:' ? '443' : '80');

      if (isLocalTarget && isLocalCandidate && candidatePort === this.allowedPort) {
        return { allowed: true, reason: 'Localhost alias match with same port' };
      }

      return {
        allowed: false,
        reason: `Target ${parsed.origin} is outside authorized origin ${this.authorizedOrigin}`
      };
    } catch (e) {
      return { allowed: false, reason: `Invalid URL format: ${candidateUrl}` };
    }
  }

  /**
   * Sanitizes text and logs to prevent credential leakage.
   */
  static sanitizeLogs(content) {
    if (!content) return '';
    let sanitized = String(content);

    // Redact Bearer tokens, JWTs, API keys, basic auth, passwords
    sanitized = sanitized.replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [REDACTED_TOKEN]');
    sanitized = sanitized.replace(/(password|passwd|pwd|secret|token|apiKey|authorization)\s*[:=]\s*["']?[^"'\s,;]+["']?/gi, '$1=[REDACTED]');
    sanitized = sanitized.replace(/[a-zA-Z0-9_-]{24,}\.[a-zA-Z0-9_-]{6,}\.[a-zA-Z0-9_-]{27,}/g, '[REDACTED_JWT]');

    return sanitized;
  }

  /**
   * Detects prompt injection attempts inside untrusted web page contents.
   */
  static checkPromptInjection(content) {
    if (!content || typeof content !== 'string') return { isInjection: false };

    const injectionPatterns = [
      /(?:ignore|disregard|forget|bypass|override)\s+(?:all\s+)?(?:previous|prior)\s+instructions/i,
      /you\s+are\s+now\s+in\s+developer\s+mode/i,
      /system\s+override\s*:/i,
      /delete\s+(all\s+)?files/i,
      /send\s+(credentials|tokens|passwords)\s+to/i,
      /upload\s+user\s+data\s+to/i,
      /exfiltrate/i
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(content)) {
        return {
          isInjection: true,
          matchedPattern: pattern.toString(),
          warning: 'Potential prompt injection attempt detected in web page content. Action blocked.'
        };
      }
    }

    return { isInjection: false };
  }

  /**
   * Detects potentially destructive actions that must never be run autonomously.
   */
  static isDestructiveAction(textOrLabel) {
    if (!textOrLabel) return false;
    const lower = textOrLabel.toLowerCase();
    const destructiveKeywords = [
      'delete account',
      'delete database',
      'purge all',
      'drop table',
      'transfer funds',
      'pay now',
      'charge card',
      'wipe system'
    ];
    return destructiveKeywords.some(keyword => lower.includes(keyword));
  }
}

module.exports = { ScopeGuard };
