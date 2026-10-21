import assert from 'node:assert/strict';
import test from 'node:test';
import { horizontalPageDirection } from '../src/reader-gestures';

test('horizontal swipes turn forward and backward', () => {
  assert.equal(horizontalPageDirection(-110, 12, 220, 390), 1);
  assert.equal(horizontalPageDirection(110, 12, 220, 390), -1);
});

test('vertical movement and short horizontal taps do not turn pages', () => {
  assert.equal(horizontalPageDirection(-30, 95, 180, 390), null);
  assert.equal(horizontalPageDirection(-40, 4, 180, 390), null);
});

test('a deliberate long swipe still turns a page on narrow phones', () => {
  assert.equal(horizontalPageDirection(-76, 8, 500, 320), 1);
});
