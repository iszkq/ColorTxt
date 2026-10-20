import { test } from 'node:test';
import assert from 'node:assert/strict';
import { characterAt, graphemes, textRange } from '../src/text-selection';
import { validAnnotations } from '../src/core';

test('dragging in either direction keeps hidden verse prefixes and multiline exports exact', () => {
  const lines = ['1　起初，神创造天地。', '2　地是空虚混沌。', '3　神说：“要有光。”'];
  const a = {line:1,column:6}, b = {line:3,column:7};
  const range = textRange(lines,b,a)!;
  assert.deepEqual(range, textRange(lines,a,b));
  assert.equal(range.text, '神创造天地。\n2　地是空虚混沌。\n3　神说：“');
  assert.equal(validAnnotations([{...range,id:'drag'}],lines).length,1);
});
test('grapheme endpoints never split emoji, combining marks or surrogate pairs', () => {
  const text = '神👨‍👩‍👧‍👦a\u0301爱𠀀人';
  assert.deepEqual(graphemes(text).map(p=>p.segment), ['神','👨‍👩‍👧‍👦','a\u0301','爱','𠀀','人']);
  for (const part of graphemes(text)) {
    const selected = textRange([text], {line:1,column:part.index+1}, {line:1,column:part.index+part.segment.length+1})!;
    assert.equal(selected.text,part.segment);
    assert.deepEqual(characterAt(text,part.index),{start:part.index,end:part.index+part.segment.length});
  }
});
test('collapsed, empty and out-of-bounds selection is rejected', () => {
  const point={line:1,column:1};
  assert.equal(textRange(['文字'],point,point),null);
  assert.equal(textRange(['文字'],point,{line:2,column:1}),null);
  assert.equal(textRange(['文字'],point,{line:1,column:10}),null);
  assert.equal(textRange(['  '],point,{line:1,column:3}),null);
});
