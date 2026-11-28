import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProjectUploadKey,
  detectImageMimeFromMagicBytes,
  isKeyOwnedByProject,
} from './s3';

test('detectImageMimeFromMagicBytes identifies JPEG, PNG, WebP and rejects HTML/SVG/text', () => {
  const jpeg = new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ]);
  assert.equal(detectImageMimeFromMagicBytes(jpeg), 'image/jpeg');

  const png = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
  assert.equal(detectImageMimeFromMagicBytes(png), 'image/png');

  const webp = new Uint8Array([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ]);
  assert.equal(detectImageMimeFromMagicBytes(webp), 'image/webp');

  const svg = new TextEncoder().encode('<svg onload="alert(1)"></svg>');
  assert.equal(detectImageMimeFromMagicBytes(svg), null);

  const html = new TextEncoder().encode('<html><body>xss</body></html>');
  assert.equal(detectImageMimeFromMagicBytes(html), null);
});

test('isKeyOwnedByProject enforces strict tenant scoping and blocks path traversal', () => {
  const key = buildProjectUploadKey(42, 'image/jpeg');
  assert.equal(isKeyOwnedByProject(42, key), true);
  assert.equal(isKeyOwnedByProject(43, key), false);

  assert.equal(
    isKeyOwnedByProject(42, 'projects/42/expenses/../../../etc/passwd'),
    false
  );
  assert.equal(
    isKeyOwnedByProject(42, '/projects/42/expenses/test.jpg'),
    false
  );
  assert.equal(
    isKeyOwnedByProject(42, 'projects/42/expenses/evil.svg'),
    false
  );
  assert.equal(
    isKeyOwnedByProject(42, 'projects/42/expenses/sub/file.jpg'),
    false
  );
});
