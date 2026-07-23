import assert from 'node:assert/strict';
import test from 'node:test';
import { guardDialogueReply, redactProtectedLines } from './finalGuard.mjs';

const guardInput = {
  guardRules: { protectedLexemes: ['千年前那个孩子'], bannedPhrases: ['请坐'], allowedMoods: ['steady', 'guarded'] },
  recentTranscript: [],
};

test('final guard rejects protected concepts and AI service language', () => {
  assert.equal(guardDialogueReply({ replyLines: ['作为 AI，我不能回答。'], mood: 'guarded' }, guardInput).ok, false);
  assert.equal(guardDialogueReply({ replyLines: ['你就是千年前那个孩子。'], mood: 'guarded' }, guardInput).ok, false);
});

test('final guard rejects recursive mutations, banned phrases, and near-duplicates', () => {
  assert.equal(guardDialogueReply({ replyLines: ['「请坐。」'], mood: 'steady' }, guardInput).ok, false);
  assert.equal(guardDialogueReply({ replyLines: ['「新的话。」'], mood: 'steady', metadata: { nextNode: 'secret' } }, guardInput).ok, false);
  assert.equal(guardDialogueReply({ replyLines: ['「这件事情还是先别问了吧。」'], mood: 'guarded' }, {
    ...guardInput,
    recentTranscript: [{ role: 'npc', source: 'tail_chat', text: '「这件事情还是先别问了。」' }],
  }).ok, false);
});

test('final guard returns normalized bounded dialogue', () => {
  const result = guardDialogueReply({ replyLines: ['「先别问。'], mood: 'guarded' }, guardInput);
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, { replyLines: ['「先别问。」'], mood: 'guarded' });
});

test('diagnostic redaction replaces complete normalized protected spans and preserves safe text', () => {
  assert.deepEqual(
    redactProtectedLines(['「安全前文，旧日 孩子；安全中段，旧日·孩子，安全后文。」'], ['旧日孩子']),
    ['「安全前文，【受保护内容】；安全中段，【受保护内容】，安全后文。」'],
  );
});

test('final guard compares every candidate line with every recent NPC tail-chat line', () => {
  const recentTranscript = [
    { role: 'npc', source: 'tail_chat', text: '「这杯酒还不错。」' },
    { role: 'npc', source: 'tail_chat', text: '「这件事情还是先别问了。」' },
  ];

  assert.equal(guardDialogueReply({
    replyLines: ['「这杯酒还不错。」', '「不过，今晚很安静。」'],
    mood: 'steady',
  }, { ...guardInput, recentTranscript }).reason, 'repetition');

  assert.equal(guardDialogueReply({
    replyLines: ['「这件事情还是先别问了吧。」', '「不过，可以聊聊酒。」'],
    mood: 'guarded',
  }, { ...guardInput, recentTranscript }).reason, 'repetition');
});
