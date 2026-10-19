import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBook, detectChapters, decodeText, segmentsForLine, validAnnotations, annotationJson, chapterAt, type Annotation } from '../src/core';

test('Chinese and Markdown chapters share the upstream rules, without treating long prose as a heading', () => {
  const chapters=detectChapters('开篇\n第一章 初见\n正文\n## 小节\n第十二回 风雨\n第一章'+ '很长的正文'.repeat(20));
  assert.deepEqual(chapters.map(c=>c.line),[1,2,4,5]);
  assert.equal(chapterAt(chapters,4),2);
});
test('UTF-8, UTF-16LE and GB18030 Chinese files decode', () => {
  const text='起初　神创造天地。';
  assert.equal(decodeText(new TextEncoder().encode(text).buffer),text);
  assert.equal(decodeText(new Uint8Array([0xff,0xfe,0x2d,0x4e,0x87,0x65]).buffer),'中文');
  assert.equal(decodeText(new Uint8Array([0xd6,0xd0,0xce,0xc4]).buffer),'中文');
});
const annotation:Annotation={id:'a',startPhysicalLine:1,startColumn:2,endPhysicalLine:2,endColumn:3,text:'乙丙\n丁戊',lineation:{type:'wavy',colorIndex:2},note:{content:'想法',createdAt:1,updatedAt:1},createdAt:1,updatedAt:1};
test('desktop annotation ranges validate quote text across physical lines', () => {
  assert.equal(validAnnotations([annotation],['甲乙丙','丁戊己']).length,1);
  assert.equal(validAnnotations([annotation],['改过的正文','丁戊己']).length,0);
  assert.equal(validAnnotations([{...annotation,endPhysicalLine:100}],['甲乙丙']).length,0);
});
test('color and overlapping annotations preserve text and UTF-16 offsets', () => {
  const text='甲乙丙'; const segments=segmentsForLine(text,1,[annotation],[{text:'乙',color:1}],true);
  assert.equal(segments.map(s=>s.text).join(''),text);
  assert.equal(segments.find(s=>s.text==='乙')?.color,1);
  assert.equal(segments.find(s=>s.text==='丙')?.annotations[0].id,'a');
  const unicode='甲😀乙'; const emoji:Annotation={...annotation,startColumn:2,endColumn:4,endPhysicalLine:1,text:'😀'};
  assert.equal(validAnnotations([emoji],[unicode]).length,1);
  assert.equal(segmentsForLine(unicode,1,[emoji],[],false).find(s=>s.annotations.length)?.text,'😀');
});
test('JSON export preserves the desktop schema and can round trip', () => {
  const b=createBook('test.txt','甲乙丙\n丁戊己');b.annotations=[annotation];
  const data=JSON.parse(annotationJson(b)); assert.equal(data.schemaVersion,1);
  assert.deepEqual(validAnnotations(data.annotations,b.content.split('\n')),b.annotations);
});
