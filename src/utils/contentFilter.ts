const NSFW_KEYWORDS = ['porn', 'xxx', 'sex', 'hentai', 'nude', 'nsfw', 'explicit']

export function validateContent(content: string): boolean {
  const lower = content.toLowerCase()
  return !NSFW_KEYWORDS.some(keyword => lower.includes(keyword))
}
