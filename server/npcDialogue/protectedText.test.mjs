import assert from 'node:assert/strict';
import test from 'node:test';
import { redactProtectedText } from './protectedText.mjs';

test('surface-span redaction handles raw whitespace and punctuation variants', () => {
  assert.equal(
    redactProtectedText(
      '甲旧日\n孩子乙旧日\t孩子丙旧日 孩子丁旧日·孩子戊',
      ['旧日孩子'],
    ),
    '甲【受保护内容】乙【受保护内容】丙【受保护内容】丁【受保护内容】戊',
  );
});
