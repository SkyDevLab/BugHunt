/**
 * Ticket Parser for BugHunt AI
 * Parses Jira, Azure DevOps, Markdown, and free-form QA tickets into structured requirements.
 */

function parseTicket(rawText) {
  if (typeof rawText !== 'string' || !rawText.trim()) {
    return {
      isValid: false,
      title: 'Untitled Ticket',
      description: '',
      acceptanceCriteria: [],
      applicationUrl: null,
      environment: 'local development',
      entities: [],
      errors: ['Ticket content is empty or invalid']
    };
  }

  const lines = rawText.split(/\r?\n/).map(l => l.trim());
  let title = '';
  let description = '';
  let applicationUrl = null;
  let environment = 'local development';
  const acceptanceCriteria = [];
  const errors = [];

  let currentSection = null;
  const descriptionLines = [];
  const acLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Check for inline Title / Summary
    const titleMatch = line.match(/^(?:#+\s*)?(?:Title|Summary|Issue):\s*(.+)$/i);
    if (titleMatch && !title) {
      title = titleMatch[1].trim();
      currentSection = null;
      continue;
    }

    // Markdown title header (# User profile update)
    const headerMatch = line.match(/^#+\s*(?:Ticket:\s*)?(.+)$/i);
    if (headerMatch && !title && !line.toLowerCase().includes('acceptance criteria') && !line.toLowerCase().includes('description')) {
      title = headerMatch[1].trim();
      currentSection = null;
      continue;
    }

    // Application URL
    const urlMatch = line.match(/(?:Application\s*URL|Target\s*URL|App\s*URL|URL):\s*(https?:\/\/[^\s]+)/i);
    if (urlMatch) {
      applicationUrl = urlMatch[1].trim();
      currentSection = null;
      continue;
    }

    // Plain URL in text if not yet found
    if (!applicationUrl) {
      const genericUrlMatch = line.match(/(https?:\/\/(?:localhost|127\.0\.0\.1|[\w.-]+)(?::\d+)?(?:\/[^\s]*)?)/i);
      if (genericUrlMatch && (line.toLowerCase().includes('http') || line.toLowerCase().includes('url') || line.toLowerCase().includes('app'))) {
        applicationUrl = genericUrlMatch[1].trim();
      }
    }

    // Environment
    const envMatch = line.match(/(?:Test\s*Environment|Environment|Env):\s*(.+)$/i);
    if (envMatch) {
      environment = envMatch[1].trim();
      currentSection = null;
      continue;
    }

    // Section header: Acceptance criteria / AC / Expected results
    if (line.match(/^(?:#+\s*)?(?:Acceptance\s*Criteria|Acceptance\s*Criterion|ACs?|Criteria|Conditions\s*of\s*Acceptance):?/i)) {
      currentSection = 'ac';
      continue;
    }

    // Section header: Description / Overview / Details
    if (line.match(/^(?:#+\s*)?(?:Description|Overview|Details|User\s*Story):?/i)) {
      currentSection = 'description';
      continue;
    }

    // If within a section
    if (currentSection === 'ac') {
      // Bullet point or numbered item
      const itemMatch = line.match(/^(?:[-*+•]|\d+[.)])\s*(.+)$/);
      if (itemMatch) {
        acLines.push(itemMatch[1].trim());
      } else if (line.length > 0 && !line.startsWith('#')) {
        acLines.push(line);
      }
    } else if (currentSection === 'description') {
      descriptionLines.push(line);
    } else if (!title) {
      // First non-empty line without explicit prefix can be candidate title
      title = line.replace(/^#+\s*/, '').trim();
    }
  }

  // Finalize Description
  description = descriptionLines.join(' ').trim();

  // If no AC section found, try to extract bullets from the whole text
  if (acLines.length === 0) {
    for (const line of lines) {
      const itemMatch = line.match(/^[-*•]\s*(.+)$/);
      if (itemMatch && !itemMatch[1].toLowerCase().startsWith('title') && !itemMatch[1].toLowerCase().startsWith('url')) {
        acLines.push(itemMatch[1].trim());
      }
    }
  }

  // Filter and deduplicate ACs
  for (const ac of acLines) {
    const cleaned = ac.replace(/^\[[ xX]\]\s*/, '').trim();
    if (cleaned && !acceptanceCriteria.includes(cleaned)) {
      acceptanceCriteria.push(cleaned);
    }
  }

  if (!title) {
    title = 'User Profile Update';
  }

  if (!applicationUrl) {
    errors.push('No application URL specified in ticket.');
  }

  if (acceptanceCriteria.length === 0) {
    errors.push('No explicit acceptance criteria found.');
  }

  // Extract detected entities/fields mentioned (e.g., name, email, password, profile, settings)
  const fullCorpus = `${title} ${description} ${acceptanceCriteria.join(' ')}`.toLowerCase();
  const knownKeywords = ['name', 'full name', 'email', 'profile', 'settings', 'save', 'refresh', 'api', 'error', 'password'];
  const entities = knownKeywords.filter(kw => fullCorpus.includes(kw));

  return {
    isValid: errors.length === 0,
    title,
    description: description || title,
    acceptanceCriteria,
    applicationUrl,
    environment,
    entities,
    errors
  };
}

module.exports = { parseTicket };
