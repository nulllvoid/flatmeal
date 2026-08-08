// Google Cloud Translate v1 (docs/06 "Translation: Google Cloud Translate
// v1"). Requires GOOGLE_TRANSLATE_API_KEY; when unset (no key provisioned
// yet), callers should fall back to English rather than fail dispatch —
// mock-mode testing must work before the key exists.
export async function translateText(text: string, targetLang: 'hi' | 'kn'): Promise<string | null> {
  const apiKey = Deno.env.get('GOOGLE_TRANSLATE_API_KEY');
  if (!apiKey || !text.trim()) return null;

  const res = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, target: targetLang, source: 'en', format: 'text' }),
  });

  if (!res.ok) return null;

  const body = await res.json();
  return body?.data?.translations?.[0]?.translatedText ?? null;
}
