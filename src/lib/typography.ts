// Правила русской типографики: короткие слова (предлоги, союзы, числа)
// не остаются в конце строки, тире не начинает строку.
const SHORT_WORD = /(^|[\s(«"])([\p{L}\d]{1,2})\s+/gu;
const NBSP = " ";

export function typo(text: string) {
  return text
    .replace(SHORT_WORD, `$1$2${NBSP}`)
    .replace(SHORT_WORD, `$1$2${NBSP}`) // второй проход — для идущих подряд коротких слов
    .replace(/\s+([-–—])\s/g, `${NBSP}$1 `);
}
