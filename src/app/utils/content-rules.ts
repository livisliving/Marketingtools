/**
 * Content Rules Engine
 * Validates banner text inputs against editorial guidelines
 * and returns actionable warnings.
 *
 * Rule IDs, severities, and the known-acronym list are all imported
 * from the shared rule-registry so they can never drift out of sync
 * with the guidelines documentation page.
 *
 * Capitalisation guidelines sourced from:
 *  - English: Sentence case default, avoid Title Case & ALL CAPS
 *  - German: Standard German Rechtschreibung (nouns capitalised, avoid Title Case & ALL CAPS)
 *  - French: Sentence case (casse de phrase), months & days lowercase, avoid Title Case & ALL CAPS
 *  - Dutch: Sentence case default (follows English pattern)
 *  - Chinese: No casing rules (logographic script)
 */

import {
  RULE_ID,
  KNOWN_ACRONYMS,
  getRuleSeverity,
  ruleWarningId,
  type ContentWarning,
} from './rule-registry';

// Re-export so existing consumers don't break
export type { ContentWarning } from './rule-registry';

// Common short words that should stay lowercase in title case (English)
const TITLE_CASE_MINOR_WORDS_EN = new Set([
  'a', 'an', 'the', 'and', 'but', 'or', 'nor', 'for', 'yet', 'so',
  'in', 'on', 'at', 'to', 'by', 'of', 'up', 'as', 'is', 'it',
]);

// German minor words — articles, prepositions, conjunctions (should stay lowercase unless sentence-initial)
const TITLE_CASE_MINOR_WORDS_DE = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer',
  'und', 'oder', 'aber', 'doch', 'noch', 'denn', 'weil', 'wenn', 'als', 'ob',
  'in', 'im', 'an', 'am', 'auf', 'aus', 'bei', 'bis', 'für', 'mit', 'nach',
  'ohne', 'um', 'von', 'vom', 'vor', 'zu', 'zum', 'zur', 'über', 'unter',
  'zwischen', 'durch', 'gegen', 'nicht', 'auch', 'schon', 'mehr', 'sehr',
  'sich', 'es', 'ist', 'sind', 'hat', 'wird', 'kann',
]);

// French minor words — articles, prepositions, conjunctions (should stay lowercase unless sentence-initial)
const TITLE_CASE_MINOR_WORDS_FR = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'au', 'aux',
  'et', 'ou', 'mais', 'ni', 'car', 'donc', 'que', 'qui', 'dont',
  'en', 'dans', 'sur', 'sous', 'avec', 'sans', 'pour', 'par', 'chez',
  'vers', 'entre', 'est', 'sont', 'ce', 'se', 'ne', 'pas',
]);

// Dutch minor words
const TITLE_CASE_MINOR_WORDS_NL = new Set([
  'de', 'het', 'een', 'en', 'of', 'maar', 'want', 'dus', 'als',
  'in', 'op', 'aan', 'bij', 'van', 'voor', 'met', 'naar', 'uit',
  'om', 'tot', 'over', 'door', 'te', 'er', 'is', 'zijn', 'dat', 'die', 'dit',
]);

function getMinorWordsForLang(lang: string): Set<string> {
  switch (lang) {
    case 'de': return TITLE_CASE_MINOR_WORDS_DE;
    case 'fr': return TITLE_CASE_MINOR_WORDS_FR;
    case 'nl': return TITLE_CASE_MINOR_WORDS_NL;
    default: return TITLE_CASE_MINOR_WORDS_EN;
  }
}

// ─── French: months & days must be lowercase ──────────
// In French, months and weekdays are never capitalised (unlike English/German).
const FRENCH_MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];
const FRENCH_DAYS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

function findCapitalisedFrenchTemporalWords(text: string): string[] {
  const found: string[] = [];
  const words = text.split(/\s+/);
  // Skip the very first word (sentence-initial capitalisation is fine)
  for (let i = 1; i < words.length; i++) {
    const clean = words[i].replace(/[^a-zA-ZÀ-ÿ]/g, '');
    if (!clean) continue;
    for (const m of [...FRENCH_MONTHS, ...FRENCH_DAYS]) {
      if (clean === m) {
        found.push(m);
      }
    }
  }
  return found;
}

// ─── Detection helpers ──────────────────────────────────

function isTitleCase(text: string, lang: string = 'en'): boolean {
  const words = text.trim().split(/\s+/).filter(w => w.length > 0);
  if (words.length < 2) return false;

  const minorWords = getMinorWordsForLang(lang);
  let capitalisedCount = 0;
  let relevantCount = 0;

  words.forEach((word, idx) => {
    const clean = word.replace(/^[^a-zA-ZÀ-ÿ]+/, '');
    if (!clean) return;

    const isMinor = minorWords.has(clean.toLowerCase());
    if (idx === 0) return;

    if (!isMinor) {
      relevantCount++;
      if (clean[0] === clean[0].toUpperCase() && clean[0] !== clean[0].toLowerCase()) {
        capitalisedCount++;
      }
    }
  });

  return relevantCount >= 1 && capitalisedCount / relevantCount >= 0.6;
}

function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^a-zA-ZÀ-ÿ]/g, '');
  return letters.length >= 3 && letters === letters.toUpperCase();
}

/** All-lowercase: has ≥3 letters and none are uppercase (first letter included) */
function isAllLowercase(text: string): boolean {
  const letters = text.replace(/[^a-zA-ZÀ-ÿ]/g, '');
  return letters.length >= 3 && letters === letters.toLowerCase();
}

/** Detect individual ALL-CAPS words (≥2 letters) in otherwise mixed-case text.
 *  Skips known acronyms (from registry) and the entire-string ALL CAPS case. */
function findBlockCapWords(text: string): string[] {
  if (isAllCaps(text)) return []; // handled by ALL CAPS rule
  const words = text.split(/\s+/);
  const found: string[] = [];
  for (const w of words) {
    const clean = w.replace(/[^a-zA-ZÀ-ÿ]/g, '');
    if (clean.length < 2) continue;
    if (clean === clean.toUpperCase() && clean !== clean.toLowerCase()) {
      if (!KNOWN_ACRONYMS.has(clean.toUpperCase())) {
        found.push(w);
      }
    }
  }
  return found;
}

function toSentenceCase(text: string): string {
  if (!text) return text;
  const trimmed = text.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

/** Capitalise only the first letter, keep the rest intact */
function capitaliseFirst(text: string): string {
  if (!text) return text;
  const trimmed = text.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function hasLeadingTrailingWhitespace(text: string): boolean {
  return text !== text.trim();
}

function hasDoubleSpaces(text: string): boolean {
  return /  +/.test(text);
}

function hasExcessiveExclamation(text: string): boolean {
  return /!{2,}/.test(text) || (text.match(/!/g) || []).length > 2;
}

function hasEllipsis(text: string): boolean {
  return /\.{3,}|…/.test(text);
}

/** Detect lenticular brackets【】and similar CJK decorative brackets */
function hasDisallowedBrackets(text: string): boolean {
  return /[【】〖〗〘〙〔〕]/.test(text);
}

/** Strip disallowed brackets from text for suggestion */
function removeDisallowedBrackets(text: string): string {
  return text.replace(/[【】〖〗〘〙〔〕]/g, '').replace(/\s{2,}/g, ' ').trim();
}

/** Emoji detection — covers most common emoji ranges */
function hasEmoji(text: string): boolean {
  return /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/u.test(text);
}

/** Strip emojis for suggestion */
function removeEmoji(text: string): string {
  return text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '').replace(/\s{2,}/g, ' ').trim();
}

/** URLs and email addresses */
function hasUrlOrEmail(text: string): boolean {
  return /https?:\/\/|www\.|\.\com|\.\org|\.\net|\.\io|\.\co\b|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text);
}

/** Hashtag patterns (#deals, #sale etc.) */
function hasHashtag(text: string): boolean {
  return /#[a-zA-Z\u4e00-\u9fff]{2,}/.test(text);
}

/** Trailing period on a headline — ".  " at end after trimming */
function hasTrailingPeriod(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.endsWith('.') && !hasEllipsis(text);
}

/** Remove trailing period for suggestion */
function removeTrailingPeriod(text: string): string {
  return text.trim().replace(/\.$/, '');
}

/** Repeated punctuation like ?? !! ,, ;; :: — but not ".." (caught by ellipsis) */
function hasRepeatedPunctuation(text: string): boolean {
  return /([?,;:\-–—])\1{1,}/.test(text);
}

/** Ampersand in running text — skip patterns like "A&B" brand names or "Q&A" */
function hasAmpersand(text: string): boolean {
  return /\s&\s/.test(text);
}

/** Newline / carriage return characters */
function hasLineBreaks(text: string): boolean {
  return /[\n\r]/.test(text);
}

/** Strip line breaks for suggestion */
function removeLineBreaks(text: string): string {
  return text.replace(/[\n\r]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

// ─── Language helpers ───────────────────────────────────

/** Languages that use a Latin-based alphabet with upper/lowercase distinctions */
function isLatinScript(lang: string): boolean {
  return lang !== 'zh';
}

/** Detect Chinese characters in text */
function hasChinese(text: string): boolean {
  return /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
}

/** Get the language-appropriate word for "and" */
function getAndWord(lang: string): string {
  switch (lang) {
    case 'de': return 'und';
    case 'fr': return 'et';
    case 'nl': return 'en';
    default: return 'and';
  }
}

// ─── Shared rules applied to all fields ─────────────────

function applyUniversalRules(
  text: string,
  prefix: string,
  lang: string,
  warnings: ContentWarning[],
) {
  // ── Emoji ──
  if (hasEmoji(text)) {
    const cleaned = removeEmoji(text);
    warnings.push({
      id: ruleWarningId(prefix, RULE_ID.EMOJI),
      severity: getRuleSeverity(RULE_ID.EMOJI),
      message: 'Emojis are not allowed in banner text',
      suggestion: cleaned || undefined,
    });
  }

  // ── URLs / emails ──
  if (hasUrlOrEmail(text)) {
    warnings.push({
      id: ruleWarningId(prefix, RULE_ID.URL),
      severity: getRuleSeverity(RULE_ID.URL),
      message: 'URLs and email addresses don\'t belong in banner copy',
    });
  }

  // ── Hashtags ──
  if (hasHashtag(text)) {
    warnings.push({
      id: ruleWarningId(prefix, RULE_ID.HASHTAG),
      severity: getRuleSeverity(RULE_ID.HASHTAG),
      message: 'Avoid hashtags — banners aren\'t social media',
    });
  }

  // ── Disallowed brackets (all langs) ──
  if (hasDisallowedBrackets(text)) {
    const cleaned = removeDisallowedBrackets(text);
    warnings.push({
      id: ruleWarningId(prefix, RULE_ID.BRACKETS),
      severity: getRuleSeverity(RULE_ID.BRACKETS),
      message: 'Lenticular brackets【】are not allowed',
      suggestion: cleaned || undefined,
    });
  }

  // ── Leading/trailing whitespace ──
  if (hasLeadingTrailingWhitespace(text)) {
    warnings.push({
      id: ruleWarningId(prefix, RULE_ID.WHITESPACE),
      severity: getRuleSeverity(RULE_ID.WHITESPACE),
      message: 'Leading or trailing whitespace detected',
    });
  }

  // ── Line breaks ──
  if (hasLineBreaks(text)) {
    const cleaned = removeLineBreaks(text);
    warnings.push({
      id: ruleWarningId(prefix, RULE_ID.LINEBREAK),
      severity: getRuleSeverity(RULE_ID.LINEBREAK),
      message: 'Line breaks detected — banner text should be single-line',
      suggestion: cleaned || undefined,
    });
  }

  // ── Double spaces (Latin only — Chinese doesn't use word spaces) ──
  if (isLatinScript(lang) && hasDoubleSpaces(text)) {
    warnings.push({
      id: ruleWarningId(prefix, RULE_ID.DOUBLESPACE),
      severity: getRuleSeverity(RULE_ID.WHITESPACE), // shares severity with whitespace
      message: 'Double spaces detected',
    });
  }

  // ── Repeated punctuation ?? ,, ;; etc. ──
  if (hasRepeatedPunctuation(text)) {
    warnings.push({
      id: ruleWarningId(prefix, RULE_ID.REPEATED_PUNCT),
      severity: getRuleSeverity(RULE_ID.REPEATED_PUNCT),
      message: 'Repeated punctuation detected (e.g. ?? or ,,)',
    });
  }
}

// ─── Public Validators ──────────────────────────────────

export function validateTitle(text: string, lang: string = 'en'): ContentWarning[] {
  const warnings: ContentWarning[] = [];
  if (!text) return warnings;

  // ── Casing rules (Latin only) ──
  if (isLatinScript(lang)) {
    if (isAllCaps(text)) {
      warnings.push({
        id: ruleWarningId('title', RULE_ID.ALLCAPS),
        severity: getRuleSeverity(RULE_ID.ALLCAPS),
        message: lang === 'de'
          ? 'Title is in ALL CAPS — use standard German capitalisation'
          : lang === 'fr'
          ? 'Title is in ALL CAPS — use sentence case (casse de phrase)'
          : 'Title is in ALL CAPS — use sentence case',
        suggestion: toSentenceCase(text),
      });
    } else if (isTitleCase(text, lang)) {
      warnings.push({
        id: ruleWarningId('title', RULE_ID.TITLECASE),
        severity: getRuleSeverity(RULE_ID.TITLECASE),
        message: lang === 'de'
          ? 'Avoid Title Case — only nouns should be capitalised in German'
          : lang === 'fr'
          ? 'Avoid Title Case — use sentence case (casse de phrase)'
          : 'Use sentence case, not Title Case',
        suggestion: toSentenceCase(text),
      });
    } else if (isAllLowercase(text)) {
      warnings.push({
        id: ruleWarningId('title', RULE_ID.LOWERCASE),
        severity: getRuleSeverity(RULE_ID.LOWERCASE),
        message: 'Title should start with a capital letter',
        suggestion: capitaliseFirst(text),
      });
    }

    // ── Block caps (individual ALL CAPS words like "BIG DEALS today") ──
    const blockCapWords = findBlockCapWords(text);
    if (blockCapWords.length > 0) {
      warnings.push({
        id: ruleWarningId('title', RULE_ID.BLOCKCAPS),
        severity: getRuleSeverity(RULE_ID.BLOCKCAPS),
        message: `Avoid ALL CAPS words: ${blockCapWords.join(', ')}. Capitalisation for emphasis must be intentional`,
      });
    }
  }

  // ── French: months and days should be lowercase ──
  if (lang === 'fr') {
    const badWords = findCapitalisedFrenchTemporalWords(text);
    if (badWords.length > 0) {
      warnings.push({
        id: ruleWarningId('title', RULE_ID.FR_TEMPORAL),
        severity: getRuleSeverity(RULE_ID.FR_TEMPORAL),
        message: `In French, months and days are lowercase: ${badWords.map(w => `"${w}" → "${w.toLowerCase()}"`).join(', ')}`,
      });
    }
  }

  // ── Trailing period ──
  if (hasTrailingPeriod(text)) {
    warnings.push({
      id: ruleWarningId('title', RULE_ID.TRAILING_PERIOD),
      severity: getRuleSeverity(RULE_ID.TRAILING_PERIOD),
      message: 'Titles shouldn\'t end with a period',
      suggestion: removeTrailingPeriod(text),
    });
  }

  // ── Exclamation ──
  if (hasExcessiveExclamation(text)) {
    warnings.push({
      id: ruleWarningId('title', RULE_ID.EXCLAMATION),
      severity: getRuleSeverity(RULE_ID.EXCLAMATION),
      message: 'Avoid excessive exclamation marks',
    });
  }

  // ── Ellipsis ──
  if (hasEllipsis(text)) {
    warnings.push({
      id: ruleWarningId('title', RULE_ID.ELLIPSIS),
      severity: getRuleSeverity(RULE_ID.ELLIPSIS),
      message: 'Avoid ellipsis in titles',
    });
  }

  // ── Ampersand ──
  if (hasAmpersand(text)) {
    const andWord = getAndWord(lang);
    warnings.push({
      id: ruleWarningId('title', RULE_ID.AMPERSAND),
      severity: getRuleSeverity(RULE_ID.AMPERSAND),
      message: `Use "${andWord}" instead of "&" in banner copy`,
    });
  }

  // ── Universal rules ──
  applyUniversalRules(text, 'title', lang, warnings);

  // ── Chinese-specific ──
  if (lang === 'zh') {
    if (/！{2,}/.test(text) || (text.match(/！/g) || []).length > 2) {
      warnings.push({
        id: ruleWarningId('title', RULE_ID.ZH_EXCLAMATION),
        severity: getRuleSeverity(RULE_ID.ZH_EXCLAMATION),
        message: 'Avoid excessive exclamation marks（！）',
      });
    }
    if (/[,.]/.test(text) && hasChinese(text)) {
      warnings.push({
        id: ruleWarningId('title', RULE_ID.ZH_PUNCTUATION),
        severity: getRuleSeverity(RULE_ID.ZH_PUNCTUATION),
        message: 'Use full-width punctuation（，。）with Chinese text',
      });
    }
  }

  return warnings;
}

export function validateSubtitle(text: string, lang: string = 'en'): ContentWarning[] {
  const warnings: ContentWarning[] = [];
  if (!text) return warnings;

  // ── Casing rules (Latin only) ──
  if (isLatinScript(lang)) {
    if (isAllCaps(text)) {
      warnings.push({
        id: ruleWarningId('sub', RULE_ID.ALLCAPS),
        severity: getRuleSeverity(RULE_ID.ALLCAPS),
        message: lang === 'de'
          ? 'Subtitle is in ALL CAPS — use standard German capitalisation'
          : lang === 'fr'
          ? 'Subtitle is in ALL CAPS — use sentence case (casse de phrase)'
          : 'Subtitle is in ALL CAPS — use sentence case',
        suggestion: toSentenceCase(text),
      });
    } else if (isTitleCase(text, lang)) {
      warnings.push({
        id: ruleWarningId('sub', RULE_ID.TITLECASE),
        severity: getRuleSeverity(RULE_ID.TITLECASE),
        message: lang === 'de'
          ? 'Avoid Title Case — only nouns should be capitalised in German'
          : lang === 'fr'
          ? 'Avoid Title Case — use sentence case (casse de phrase)'
          : 'Use sentence case, not Title Case',
        suggestion: toSentenceCase(text),
      });
    } else if (isAllLowercase(text)) {
      warnings.push({
        id: ruleWarningId('sub', RULE_ID.LOWERCASE),
        severity: getRuleSeverity(RULE_ID.LOWERCASE),
        message: 'Subtitle should start with a capital letter',
        suggestion: capitaliseFirst(text),
      });
    }

    // ── Block caps ──
    const blockCapWords = findBlockCapWords(text);
    if (blockCapWords.length > 0) {
      warnings.push({
        id: ruleWarningId('sub', RULE_ID.BLOCKCAPS),
        severity: getRuleSeverity(RULE_ID.BLOCKCAPS),
        message: `Avoid ALL CAPS words: ${blockCapWords.join(', ')}. Capitalisation for emphasis must be intentional`,
      });
    }
  }

  // ── French: months and days should be lowercase ──
  if (lang === 'fr') {
    const badWords = findCapitalisedFrenchTemporalWords(text);
    if (badWords.length > 0) {
      warnings.push({
        id: ruleWarningId('sub', RULE_ID.FR_TEMPORAL),
        severity: getRuleSeverity(RULE_ID.FR_TEMPORAL),
        message: `In French, months and days are lowercase: ${badWords.map(w => `"${w}" → "${w.toLowerCase()}"`).join(', ')}`,
      });
    }
  }

  // ── Trailing period ──
  if (hasTrailingPeriod(text)) {
    warnings.push({
      id: ruleWarningId('sub', RULE_ID.TRAILING_PERIOD),
      severity: getRuleSeverity(RULE_ID.TRAILING_PERIOD),
      message: 'Subtitles shouldn\'t end with a period',
      suggestion: removeTrailingPeriod(text),
    });
  }

  // ── Ampersand ──
  if (hasAmpersand(text)) {
    const andWord = getAndWord(lang);
    warnings.push({
      id: ruleWarningId('sub', RULE_ID.AMPERSAND),
      severity: getRuleSeverity(RULE_ID.AMPERSAND),
      message: `Use "${andWord}" instead of "&" in banner copy`,
    });
  }

  // ── Universal rules ──
  applyUniversalRules(text, 'sub', lang, warnings);

  // ── Chinese-specific ──
  if (lang === 'zh') {
    if (/[,.]/.test(text) && hasChinese(text)) {
      warnings.push({
        id: ruleWarningId('sub', RULE_ID.ZH_PUNCTUATION),
        severity: getRuleSeverity(RULE_ID.ZH_PUNCTUATION),
        message: 'Use full-width punctuation（，。）with Chinese text',
      });
    }
  }

  return warnings;
}

export function validateButtonText(text: string, lang: string = 'en'): ContentWarning[] {
  const warnings: ContentWarning[] = [];
  if (!text) return warnings;

  // ── Casing (Latin only) ──
  if (isLatinScript(lang)) {
    if (isAllCaps(text)) {
      warnings.push({
        id: ruleWarningId('btn', RULE_ID.ALLCAPS),
        severity: getRuleSeverity(RULE_ID.ALLCAPS),
        message: lang === 'de'
          ? 'Button text is in ALL CAPS — use standard German capitalisation'
          : lang === 'fr'
          ? 'Button text is in ALL CAPS — use sentence case (casse de phrase)'
          : 'Button text is in ALL CAPS — use sentence case',
        suggestion: toSentenceCase(text),
      });
    } else if (isTitleCase(text, lang)) {
      warnings.push({
        id: ruleWarningId('btn', RULE_ID.TITLECASE),
        severity: getRuleSeverity(RULE_ID.TITLECASE),
        message: lang === 'de'
          ? 'Avoid Title Case for buttons — only nouns should be capitalised'
          : lang === 'fr'
          ? 'Avoid Title Case for buttons — use sentence case (casse de phrase)'
          : 'Use sentence case for buttons, not Title Case',
        suggestion: toSentenceCase(text),
      });
    } else if (isAllLowercase(text)) {
      warnings.push({
        id: ruleWarningId('btn', RULE_ID.LOWERCASE),
        severity: getRuleSeverity(RULE_ID.LOWERCASE),
        message: 'Button text should start with a capital letter',
        suggestion: capitaliseFirst(text),
      });
    }

    // ── Block caps ──
    const blockCapWords = findBlockCapWords(text);
    if (blockCapWords.length > 0) {
      warnings.push({
        id: ruleWarningId('btn', RULE_ID.BLOCKCAPS),
        severity: getRuleSeverity(RULE_ID.BLOCKCAPS),
        message: `Avoid ALL CAPS words in buttons: ${blockCapWords.join(', ')}`,
      });
    }
  }

  // ── Universal rules ──
  applyUniversalRules(text, 'btn', lang, warnings);

  return warnings;
}
