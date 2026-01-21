/**
 * File Parser tests
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { fileParser } from '../utils/fileParser.js';

describe('FileParser', () => {
  it('should parse plain text file', async () => {
    const text = 'This is a test contract.\nLine 2.\nLine 3.';
    const buffer = Buffer.from(text, 'utf-8');

    const result = await fileParser.parse(buffer, 'text/plain', 'test.txt');

    assert.strictEqual(result.text, text);
    assert.strictEqual(result.text.split('\n').length, 3);
  });

  it('should detect supported MIME types', () => {
    const supported = fileParser.getSupportedMimeTypes();

    assert.ok(supported.includes('text/plain'));
    assert.ok(supported.includes('application/pdf'));
    assert.ok(supported.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
  });

  it('should check if MIME type is supported', () => {
    assert.strictEqual(fileParser.isSupported('text/plain'), true);
    assert.strictEqual(fileParser.isSupported('application/pdf'), true);
    assert.strictEqual(fileParser.isSupported('application/vnd.openxmlformats-officedocument.wordprocessingml.document'), true);
    assert.strictEqual(fileParser.isSupported('application/unsupported'), false);
  });

  it('should throw error for unsupported MIME type', async () => {
    const buffer = Buffer.from('test', 'utf-8');

    await assert.rejects(
      async () => {
        await fileParser.parse(buffer, 'application/unsupported', 'test.bin');
      },
      /Unsupported MIME type/
    );
  });

  it('should handle empty text file', async () => {
    const buffer = Buffer.from('', 'utf-8');

    const result = await fileParser.parse(buffer, 'text/plain', 'empty.txt');

    assert.strictEqual(result.text, '');
  });
});
