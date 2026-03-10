/**
 * Rule Registry — Single source of truth for all content validation rules.
 *
 * Both the validation engine (content-rules.ts) and the guidelines page
 * (GuidelinesPage.tsx) consume this registry, so documentation can never
 * drift out of sync with the actual rules.
 *
 * Icon names reference lucide-react icon component names so the guidelines
 * page can resolve them to JSX without importing React here.
 */

/* ─── Types ──────────────────────────────────────────── */

export type RuleSeverity = 'error' | 'warning' | 'info';

export type RuleScope = 'latin' | 'chinese' | 'french' | 'universal';

export interface ContentWarning {
  id: string;
  severity: 'warning' | 'error';
  message: string;
  suggestion?: string;
}

export interface RuleDefinition {
  /** Stable identifier — must match the id suffix used in content-rules.ts */
  id: string;
  /** Human-readable title shown in guidelines */
  title: string;
  /** Full description for the guidelines page */
  description: string;
  /** Severity level: error blocks export, warning is advisory */
  severity: RuleSeverity;
  /** lucide-react icon name (PascalCase) */
  icon: string;
  /** Which text fields this rule applies to */
  appliesTo: ('title' | 'subtitle' | 'button')[];
  /** Language scope */
  scope: RuleScope;
  /** Category for grouping in the guidelines page */
  category: 'text' | 'capitalisation';
}

/* ─── Rule ID Constants ──────────────────────────────── */
/* content-rules.ts imports these so IDs can never go out of sync */

export const RULE_ID = {
  ALLCAPS: 'allcaps',
  CHAR_LIMIT: 'char-limit',
  EMOJI: 'emoji',
  URL: 'url',
  BRACKETS: 'brackets',
  BLOCKCAPS: 'blockcaps',
  TITLECASE: 'titlecase',
  LOWERCASE: 'lowercase',
  HASHTAG: 'hashtag',
  AMPERSAND: 'ampersand',
  TRAILING_PERIOD: 'trailing-period',
  EXCLAMATION: 'exclamation',
  ELLIPSIS: 'ellipsis',
  REPEATED_PUNCT: 'repeated-punct',
  WHITESPACE: 'whitespace',
  DOUBLESPACE: 'doublespace',
  LINEBREAK: 'linebreak',
  ZH_EXCLAMATION: 'zh-exclamation',
  ZH_PUNCTUATION: 'zh-punctuation',
  FR_TEMPORAL: 'fr-temporal',
} as const;

/** Build a full warning ID from a field prefix and rule ID constant */
export function ruleWarningId(prefix: string, ruleId: string): string {
  return `${prefix}-${ruleId}`;
}

/** Look up a rule's severity from the registry. Falls back to 'warning'. */
export function getRuleSeverity(id: string): 'error' | 'warning' {
  const rule = RULE_REGISTRY.find(r => r.id === id);
  return rule?.severity === 'error' ? 'error' : 'warning';
}

/* ─── Known Acronyms ─────────────────────────────────── */
/* Exported so content-rules.ts uses the same list and the
   guidelines page can display it. */

export const KNOWN_ACRONYMS = new Set([
  'UK', 'US', 'USA', 'EU', 'FAQ', 'CEO', 'TV', 'PC', 'IT', 'AI',
  'VR', 'AR', 'XR', 'USB', 'LED', 'HD', 'UHD', 'SSD', 'NFC', 'GPS',
  'DIY', 'PDF', 'SMS', 'API', 'URL', 'VP', 'CTO', 'CFO', 'COO',
  'IBAN', 'BIC', 'GMBH', 'TVA', 'CTA',
]);

/* ─── Rule Definitions ───────────────────────────────── */

export const RULE_REGISTRY: RuleDefinition[] = [
  // ═══════════════════════════════════════════
  //  TEXT RULES — Export blockers
  // ═══════════════════════════════════════════
  {
    id: RULE_ID.ALLCAPS,
    title: 'Entire field in ALL CAPS',
    description:
      "If the entire title, subtitle, or button text is written in ALL CAPS (e.g. 'SAVE BIG TODAY'), export is blocked. The tool suggests a sentence-case alternative with a one-click fix.",
    severity: 'error',
    icon: 'CaseSensitive',
    appliesTo: ['title', 'subtitle', 'button'],
    scope: 'latin',
    category: 'text',
  },
  {
    id: RULE_ID.CHAR_LIMIT,
    title: 'Character limits',
    description:
      'Each format defines maximum character counts for title and subtitle. Exceeding the limit blocks export for that format. Check the format specs table above for exact limits.',
    severity: 'error',
    icon: 'Hash',
    appliesTo: ['title', 'subtitle'],
    scope: 'universal',
    category: 'text',
  },
  {
    id: RULE_ID.EMOJI,
    title: 'No emojis',
    description:
      'Emojis are not allowed in any banner text field. They look unprofessional in campaign banners and render inconsistently across platforms. The fix strips all emojis automatically.',
    severity: 'error',
    icon: 'SmilePlus',
    appliesTo: ['title', 'subtitle', 'button'],
    scope: 'universal',
    category: 'text',
  },
  {
    id: RULE_ID.URL,
    title: 'No URLs or email addresses',
    description:
      "Web addresses (http://, www.) and email addresses don't belong in banner copy. These are detected and block export immediately.",
    severity: 'error',
    icon: 'Link2',
    appliesTo: ['title', 'subtitle', 'button'],
    scope: 'universal',
    category: 'text',
  },
  {
    id: RULE_ID.BRACKETS,
    title: 'No lenticular brackets',
    description:
      'CJK lenticular brackets\u3010\u3011and related decorative bracket pairs\uff08\u3016\u3017\u3001\u3018\u3019\u3001\u3014\u3015\uff09are not allowed in any language. The fix removes them and cleans up spacing.',
    severity: 'error',
    icon: 'Braces',
    appliesTo: ['title', 'subtitle', 'button'],
    scope: 'universal',
    category: 'text',
  },

  // ═══════════════════════════════════════════
  //  TEXT RULES — Warnings
  // ═══════════════════════════════════════════
  {
    id: RULE_ID.BLOCKCAPS,
    title: 'Individual ALL CAPS words',
    description:
      "Individual ALL CAPS words within otherwise normal text (e.g. 'Save BIG today') are flagged as a warning but do not block export. Capitalisation for emphasis is allowed when intentionally planned. Known acronyms are excluded (see list below).",
    severity: 'warning',
    icon: 'ALargeSmall',
    appliesTo: ['title', 'subtitle', 'button'],
    scope: 'latin',
    category: 'text',
  },
  {
    id: RULE_ID.TITLECASE,
    title: 'Sentence case required',
    description:
      'Title Case is detected and flagged. Only the first word and proper nouns should be capitalised. The tool will auto-suggest a corrected version.',
    severity: 'warning',
    icon: 'CaseSensitive',
    appliesTo: ['title', 'subtitle', 'button'],
    scope: 'latin',
    category: 'text',
  },
  {
    id: RULE_ID.LOWERCASE,
    title: 'No all-lowercase',
    description:
      'Titles, subtitles, and button text that are entirely lowercase are flagged. At minimum, the first letter should be capitalised. A one-click fix capitalises the first character.',
    severity: 'warning',
    icon: 'ALargeSmall',
    appliesTo: ['title', 'subtitle', 'button'],
    scope: 'latin',
    category: 'text',
  },
  {
    id: RULE_ID.HASHTAG,
    title: 'No hashtags',
    description:
      "Social media-style hashtags (#sale, #deals) don't belong on professional banners. Use proper sentence copy instead.",
    severity: 'warning',
    icon: 'Hash',
    appliesTo: ['title', 'subtitle', 'button'],
    scope: 'universal',
    category: 'text',
  },
  {
    id: RULE_ID.AMPERSAND,
    title: "Use 'and' instead of '&'",
    description:
      'Ampersands in running text (e.g. \'phones & tablets\') should be written as \'and\' for professional banner copy. Adapts per language: German \u2192 "und", French \u2192 "et", Dutch \u2192 "en". Tight brand-style usage like \'H&M\' is not flagged.',
    severity: 'warning',
    icon: 'Type',
    appliesTo: ['title', 'subtitle'],
    scope: 'universal',
    category: 'text',
  },
  {
    id: RULE_ID.TRAILING_PERIOD,
    title: 'No trailing periods',
    description:
      "Titles and subtitles are headlines \u2014 they should not end with a period. The fix removes the trailing period.",
    severity: 'warning',
    icon: 'CircleDot',
    appliesTo: ['title', 'subtitle'],
    scope: 'universal',
    category: 'text',
  },
  {
    id: RULE_ID.EXCLAMATION,
    title: 'No excessive exclamation',
    description:
      'Multiple exclamation marks (!!) or more than two single exclamation marks in a field are flagged. Keep copy clean and direct.',
    severity: 'warning',
    icon: 'Type',
    appliesTo: ['title'],
    scope: 'universal',
    category: 'text',
  },
  {
    id: RULE_ID.ELLIPSIS,
    title: 'No ellipsis',
    description:
      'Ellipsis characters (\u2026) or triple dots (...) in titles are flagged. Headlines should be direct and complete.',
    severity: 'warning',
    icon: 'Type',
    appliesTo: ['title'],
    scope: 'universal',
    category: 'text',
  },
  {
    id: RULE_ID.REPEATED_PUNCT,
    title: 'No repeated punctuation',
    description:
      'Doubled punctuation like ??, ,,, ;;, or :: is flagged. Each punctuation mark should appear only once.',
    severity: 'warning',
    icon: 'Repeat',
    appliesTo: ['title', 'subtitle', 'button'],
    scope: 'universal',
    category: 'text',
  },
  {
    id: RULE_ID.WHITESPACE,
    title: 'Whitespace issues',
    description:
      'Leading/trailing whitespace and double spaces are detected and warned. Clean text reads better in the final banner.',
    severity: 'warning',
    icon: 'Space',
    appliesTo: ['title', 'subtitle', 'button'],
    scope: 'universal',
    category: 'text',
  },
  {
    id: RULE_ID.LINEBREAK,
    title: 'No line breaks',
    description:
      'Pasted text sometimes contains hidden newline characters. Banner text should be single-line \u2014 the fix replaces line breaks with spaces.',
    severity: 'warning',
    icon: 'CornerDownLeft',
    appliesTo: ['title', 'subtitle', 'button'],
    scope: 'universal',
    category: 'text',
  },

  // ═══════════════════════════════════════════
  //  CHINESE-SPECIFIC
  // ═══════════════════════════════════════════
  {
    id: RULE_ID.ZH_EXCLAMATION,
    title: 'Full-width exclamation marks',
    description:
      'Excessive full-width exclamation marks\uff08\uff01\uff01\uff09are flagged.',
    severity: 'warning',
    icon: 'Type',
    appliesTo: ['title'],
    scope: 'chinese',
    category: 'capitalisation',
  },
  {
    id: RULE_ID.ZH_PUNCTUATION,
    title: 'Half-width punctuation',
    description:
      'Half-width punctuation mixed with Chinese characters is flagged \u2014 use full-width equivalents\uff08\uff0c\u3002\uff09.',
    severity: 'warning',
    icon: 'Type',
    appliesTo: ['title', 'subtitle'],
    scope: 'chinese',
    category: 'capitalisation',
  },

  // ═══════════════════════════════════════════
  //  FRENCH-SPECIFIC
  // ═══════════════════════════════════════════
  {
    id: RULE_ID.FR_TEMPORAL,
    title: 'French months & days lowercase',
    description:
      'In French, months and days of the week are never capitalised (e.g. "mars", not "Mars"; "lundi", not "Lundi"). Proper nouns, brand names, and holidays (No\u00ebl, P\u00e2ques) are capitalised.',
    severity: 'warning',
    icon: 'Globe',
    appliesTo: ['title', 'subtitle'],
    scope: 'french',
    category: 'capitalisation',
  },
];

/* ─── Capitalisation Language Guides ─────────────────── */
/* Per-language capitalisation cards for the guidelines page.
   Each entry defines the copy and examples shown in the
   capitalisation section so they stay in sync with the rules. */

export interface LanguageCapGuide {
  /** Language code matching the app's LangCode type */
  code: string;
  /** Display name */
  name: string;
  /** Short code label shown as badge suffix */
  shortLabel: string;
  /** Prose description of the capitalisation rules */
  description: string;
  /** Correct examples (joined with middot in the UI) */
  correctExamples: string[];
  /** Incorrect examples with annotations */
  incorrectExamples: { text: string; note: string }[];
  /** Whether this language uses Latin script (has casing rules) */
  hasCase: boolean;
}

export const LANGUAGE_CAP_GUIDES: LanguageCapGuide[] = [
  {
    code: 'en',
    name: 'English',
    shortLabel: 'EN',
    description:
      'Sentence case is the default. Only the first letter of the first word is capitalised. Standard English rules apply for proper nouns, brand names, acronyms, countries, holidays, months, and days.',
    correctExamples: ['Add to cart', 'Order summary', 'Pay with Apple Pay'],
    incorrectExamples: [
      { text: 'Add To Cart', note: 'Title Case' },
      { text: 'ADD TO CART', note: 'ALL CAPS' },
      { text: 'PAYMENT FAILED', note: 'ALL CAPS' },
    ],
    hasCase: true,
  },
  {
    code: 'de',
    name: 'German',
    shortLabel: 'DE',
    description:
      'Standard German spelling rules (Rechtschreibung) apply. All nouns are capitalised (first letter only, not the entire word). Verbs, adjectives, prepositions, and articles stay lowercase. Nominalised verbs/adjectives are also capitalised (e.g. \u201cdas Lesen\u201d, \u201cetwas Neues\u201d). Brand names follow their own spelling (e.g. eBay, PayPal).',
    correctExamples: ['In den Warenkorb', 'Bestell\u00fcbersicht', 'Im M\u00e4rz mehr sparen'],
    incorrectExamples: [
      { text: 'In Den Warenkorb', note: 'Title Case' },
      { text: 'Jetzt Kaufen', note: 'verb capitalised' },
      { text: 'IN DEN WARENKORB', note: 'ALL CAPS' },
    ],
    hasCase: true,
  },
  {
    code: 'fr',
    name: 'French',
    shortLabel: 'FR',
    description:
      'Sentence case (casse de phrase) is the default. Unlike English, months and days of the week are never capitalised in French (e.g. \u201cmars\u201d, not \u201cMars\u201d; \u201clundi\u201d, not \u201cLundi\u201d). Proper nouns, brand names, and holidays (No\u00ebl, P\u00e2ques) are capitalised. Nationalities and language names are lowercase when used as adjectives (e.g. \u201cfran\u00e7ais\u201d, \u201canglais\u201d).',
    correctExamples: ['Ajouter au panier', '\u00c9conomisez plus pendant la grande promo de mars'],
    incorrectExamples: [
      { text: 'Ajouter Au Panier', note: 'Title Case' },
      { text: 'AJOUTER AU PANIER', note: 'ALL CAPS' },
      { text: '...de Mars', note: 'month capitalised' },
    ],
    hasCase: true,
  },
  {
    code: 'nl',
    name: 'Dutch',
    shortLabel: 'NL',
    description:
      'Sentence case is the default, following the same pattern as English. Only the first letter of the first word is capitalised. Proper nouns and brand names keep their own capitalisation.',
    correctExamples: ['In winkelwagen', 'Meer besparen in maart'],
    incorrectExamples: [
      { text: 'In Winkelwagen', note: 'Title Case' },
      { text: 'IN WINKELWAGEN', note: 'ALL CAPS' },
    ],
    hasCase: true,
  },
  {
    code: 'zh',
    name: 'Chinese',
    shortLabel: '\u4e2d\u6587',
    description:
      'Chinese has no uppercase/lowercase distinction, so casing rules are skipped. Language-specific checks include:',
    correctExamples: [],
    incorrectExamples: [],
    hasCase: false,
  },
];

/* ─── Helpers ────────────────────────────────────────── */

/** All rules that belong to the "Text & copy" guidelines section */
export function getTextRules(): RuleDefinition[] {
  return RULE_REGISTRY.filter(r => r.category === 'text');
}

/** Error-level text rules (export blockers) */
export function getTextErrors(): RuleDefinition[] {
  return getTextRules().filter(r => r.severity === 'error');
}

/** Warning-level text rules */
export function getTextWarnings(): RuleDefinition[] {
  return getTextRules().filter(r => r.severity === 'warning');
}

/** All capitalisation / language-specific rules */
export function getCapitalisationRules(): RuleDefinition[] {
  return RULE_REGISTRY.filter(r => r.category === 'capitalisation');
}

/** Chinese-specific rules */
export function getChineseRules(): RuleDefinition[] {
  return RULE_REGISTRY.filter(r => r.scope === 'chinese');
}

/** French-specific rules */
export function getFrenchRules(): RuleDefinition[] {
  return RULE_REGISTRY.filter(r => r.scope === 'french');
}

/** Universal rules (apply to all languages) — grouped by severity */
export function getUniversalRules(): { errors: RuleDefinition[]; warnings: RuleDefinition[] } {
  const universal = RULE_REGISTRY.filter(r => r.scope === 'universal');
  return {
    errors: universal.filter(r => r.severity === 'error'),
    warnings: universal.filter(r => r.severity === 'warning'),
  };
}
