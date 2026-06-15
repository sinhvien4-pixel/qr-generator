// ASCII-only terms use whole-word matching (\b) to avoid false positives
// e.g. "cum" won't match "accumulate", "anal" won't match "analysis"
const WHOLE_WORD_TERMS: string[] = [
  // English
  'porn', 'porno', 'pornography', 'xxx', 'sex', 'sexy', 'nude', 'naked',
  'nsfw', 'explicit', 'hentai', 'fetish', 'onlyfans', 'camgirl', 'camsex',
  'escort', 'hooker', 'prostitute', 'blowjob', 'handjob', 'cum', 'orgasm',
  'anal', 'pornhub',
  // Unaccented Vietnamese kept with word boundary to avoid substring hits
  'dit', 'buoi',
]

// Accented Vietnamese words and multi-word phrases are specific enough
// that simple substring matching won't cause false positives
const SUBSTRING_TERMS: string[] = [
  'địt', 'địt mẹ mày', 'địt con mẹ mày', 'địt con mẹ nhà mày',
  'đụ', 'đụ mẹ mày',
  'đéo',
  'lồn', 'cặc', 'buồi', 'dâm',
  'khiêu dâm', 'phim sex', 'phim người lớn', 'gái gọi', 'mại dâm',
  'thủ dâm', 'quan hệ tình dục', '18+',
  'con mẹ mày', 'con chó đẻ',
  'chịch', 'chịch nhau',
  'hiếp', 'hiếp dâm',
]

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const wholeWordRegex = new RegExp(
  `\\b(${WHOLE_WORD_TERMS.map(escapeRegex).join('|')})\\b`,
  'i',
)

export function validateContent(content: string): boolean {
  if (wholeWordRegex.test(content)) return false
  const lower = content.toLowerCase()
  return !SUBSTRING_TERMS.some(term => lower.includes(term.toLowerCase()))
}
