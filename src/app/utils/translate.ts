import type { LangCode } from '../components/Generator';

/** MyMemory API language codes */
const LANG_MAP: Record<Exclude<LangCode, 'en'>, string> = {
  zh: 'zh-CN',
  nl: 'nl',
  fr: 'fr',
  de: 'de',
};

/**
 * Translate a single string from English using the free MyMemory API.
 * Returns the original text on failure so the user can manually translate.
 * Throws a RateLimitError if the daily quota is exceeded.
 */
export class RateLimitError extends Error {
  constructor() {
    super('Translation rate limit reached');
    this.name = 'RateLimitError';
  }
}

export async function translateText(
  text: string,
  targetLang: Exclude<LangCode, 'en'>,
): Promise<string> {
  if (!text.trim()) return '';

  const target = LANG_MAP[targetLang];
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${target}`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // MyMemory returns responseStatus 429 or quotaFinished when limit is reached
    if (
      data?.responseStatus === 429 ||
      data?.quotaFinished ||
      (data?.responseData?.translatedText ?? '').toUpperCase().includes('MYMEMORY WARNING')
    ) {
      throw new RateLimitError();
    }

    const translated: string | undefined = data?.responseData?.translatedText;
    if (!translated) throw new Error('No translation returned');
    // MyMemory sometimes returns all-caps — normalise to sentence case if original wasn't all-caps
    if (translated === translated.toUpperCase() && text !== text.toUpperCase()) {
      return translated.charAt(0).toUpperCase() + translated.slice(1).toLowerCase();
    }
    return translated;
  } catch (err) {
    if (err instanceof RateLimitError) throw err; // Bubble up rate limit errors
    console.warn(`Translation failed for "${text}" → ${targetLang}`, err);
    return text; // Fallback to original
  }
}

/**
 * Translate title, subtitle and button text in one go.
 * Returns { title, subtitle, buttonText } in the target language.
 */
export async function translateAll(
  title: string,
  subtitle: string,
  buttonText: string,
  targetLang: Exclude<LangCode, 'en'>,
): Promise<{ title: string; subtitle: string; buttonText: string }> {
  const [t, s, b] = await Promise.all([
    translateText(title, targetLang),
    translateText(subtitle, targetLang),
    translateText(buttonText, targetLang),
  ]);
  return { title: t, subtitle: s, buttonText: b };
}