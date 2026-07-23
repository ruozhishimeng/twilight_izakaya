const IGNORED_CHARACTER = /[\s\p{P}\p{S}]/u;

export function normalizeProtectedText(value) {
  return String(value || '').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}

function searchableCharacters(value) {
  const result = [];
  let offset = 0;
  for (const character of String(value)) {
    const start = offset;
    offset += character.length;
    if (!IGNORED_CHARACTER.test(character)) {
      result.push({ normalized: character.toLowerCase(), start, end: offset });
    }
  }
  return result;
}

function protectedSpans(value, protectedLexemes) {
  const searchable = searchableCharacters(value);
  const spans = [];
  for (const lexeme of protectedLexemes || []) {
    const target = Array.from(normalizeProtectedText(lexeme));
    if (!target.length) continue;
    for (let start = 0; start <= searchable.length - target.length; start += 1) {
      const matches = target.every((character, offset) =>
        searchable[start + offset]?.normalized === character);
      if (matches) {
        spans.push({
          start: searchable[start].start,
          end: searchable[start + target.length - 1].end,
        });
      }
    }
  }
  const nonOverlapping = [];
  for (const span of spans.sort((left, right) => left.start - right.start || right.end - left.end)) {
    if (!nonOverlapping.length || span.start >= nonOverlapping.at(-1).end) nonOverlapping.push(span);
  }
  return nonOverlapping;
}

export function containsProtectedText(value, protectedLexemes = []) {
  return protectedSpans(value, protectedLexemes).length > 0;
}

export function redactProtectedText(value, protectedLexemes = []) {
  const text = String(value);
  const spans = protectedSpans(text, protectedLexemes);
  if (!spans.length) return text;
  let redacted = '';
  let cursor = 0;
  for (const span of spans) {
    redacted += `${text.slice(cursor, span.start)}【受保护内容】`;
    cursor = span.end;
  }
  return redacted + text.slice(cursor);
}
