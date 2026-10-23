// npm test. Plain Node (--experimental-strip-types), no test framework: covers the logic whose
// mistakes would be silent, wrong data rather than crashes.
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { quoteParts, stem, textKind } from '../src/shared/api.ts'
import { canonicalTags, jaccard, paletteSimilarity, parse, relevance, rgb, visualSimilarity } from '../src/main/scoring.ts'

test('quote or snippet: a quoted span makes a quote', () => {
  assert.equal(textKind('"All our dreams can come true"'), 'quote')
  assert.equal(textKind('He said “hi” to me'), 'quote')
  assert.equal(textKind('«Bonjour»'), 'quote')
  assert.equal(textKind('Since launching in 2026, Natively has become…'), 'snippet')
  assert.equal(textKind('one " mark only'), 'snippet')
})

test('a trailing dash line is the quote author', () => {
  assert.deepEqual(quoteParts('“Be yourself; everyone else is already taken.”\n— Oscar Wilde'), {
    text: 'Be yourself; everyone else is already taken.',
    author: 'Oscar Wilde'
  })
  assert.deepEqual(quoteParts('"Less is more" - Mies'), { text: 'Less is more', author: 'Mies' })
  assert.deepEqual(quoteParts('So many books, so little time.'), { text: 'So many books, so little time.', author: null })
  assert.deepEqual(quoteParts('I came — I saw'), { text: 'I came — I saw', author: null })
})

test('AI output: JSON is found inside prose or a code fence', () => {
  const r = parse('Sure!\n```json\n{"title":" Dark portrait ","tldr":"A face.","tags":["Moody","IMAGE","b&w"],"text":""}\n```')
  assert.equal(r.title, 'Dark portrait')
  assert.deepEqual(r.tags, ['moody', 'b&w']) // lowercased; the kind word dropped
})

test('AI output: missing or wrong-typed fields become empty, tags are capped at 10', () => {
  const r = parse(JSON.stringify({ title: 7, tags: Array.from({ length: 15 }, (_, i) => `t${i}`) }))
  assert.equal(r.title, '')
  assert.equal(r.tldr, '')
  assert.equal(r.tags.length, 10)
  assert.throws(() => parse('no json here'), /did not return JSON/)
})

test('tag endings fold onto the existing spelling', () => {
  assert.equal(stem('motivational'), stem('motivation'))
  assert.equal(stem('photos'), stem('photo'))
  assert.equal(stem('images'), stem('image'))
  assert.equal(stem('s'), 's') // never strip a tag down to nothing
  assert.deepEqual(canonicalTags(['motivational', 'photos', 'new tag', 'photo'], ['motivation', 'photo']), [
    'motivation',
    'photo',
    'new tag'
  ])
})

test('same vibe: tag overlap', () => {
  assert.equal(jaccard(new Set(['a', 'b']), new Set(['b', 'c'])), 1 / 3)
  assert.equal(jaccard(new Set(), new Set(['a'])), 0)
  assert.equal(jaccard(undefined, new Set(['a'])), 0)
})

test('same vibe: palettes', () => {
  assert.deepEqual(rgb('#ff5a1f'), [255, 90, 31])
  const warm = [rgb('#ff5a1f'), rgb('#d9a21b')]
  assert.equal(paletteSimilarity(warm, warm), 1)
  assert.ok(paletteSimilarity(warm, [rgb('#1d2026'), rgb('#4a7fe0')]) < 0.3)
  assert.equal(paletteSimilarity([], warm), 0)
})

test('same vibe: CLIP cosine maps 0.5-0.9 onto 0-1', () => {
  const unit = (...v: number[]) => {
    const n = Math.hypot(...v)
    return Float32Array.from(v, (x) => x / n)
  }
  assert.ok(Math.abs(visualSimilarity(unit(1, 0), unit(1, 0)) - 1) < 1e-6)
  assert.equal(visualSimilarity(unit(1, 0), unit(0, 1)), 0) // cosine 0 is below the floor
  assert.ok(Math.abs(visualSimilarity(unit(1, 0), unit(0.7, Math.sqrt(1 - 0.49))) - 0.5) < 1e-6) // cosine 0.7
})

test('search relevance is clamped to 0-1', () => {
  assert.equal(relevance(0.1, 0.2, 0.32), 0)
  assert.equal(relevance(0.5, 0.2, 0.32), 1)
  assert.ok(Math.abs(relevance(0.26, 0.2, 0.32) - 0.5) < 1e-9)
})

test('archive PIN: six digits only; only the same PIN matches, and it is never stored as given', async () => {
  const { isPin, passwordMatches, sealPassword } = await import('../src/main/password.ts')
  assert.ok(isPin('012345'))
  for (const bad of ['12345', '1234567', '12345a', ' 123456', 123456]) assert.ok(!isPin(bad), String(bad))
  const sealed = sealPassword('482913')
  assert.ok(!sealed.includes('482913'))
  assert.ok(passwordMatches('482913', sealed))
  assert.ok(!passwordMatches('482914', sealed))
  assert.ok(!passwordMatches('', sealed))
  assert.notEqual(sealPassword('482913'), sealed) // a fresh salt each time
})
