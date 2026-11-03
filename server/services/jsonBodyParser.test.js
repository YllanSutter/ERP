import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createJsonBodyParser } from './jsonBodyParser.js';

function parse(payload, limit) {
  return new Promise((resolve, reject) => {
    const body = Buffer.from(JSON.stringify(payload));
    const req = Readable.from([body], { objectMode: false });
    req.headers = { 'content-type': 'application/json', 'content-length': String(body.length) };
    req.method = 'POST';
    const res = {
      status(code) { this.statusCode = code; return this; },
      json(value) { resolve({ status: this.statusCode, body: value }); },
    };
    createJsonBodyParser(limit)(req, res, (error) => {
      if (error) reject(error);
      else resolve({ status: 200, body: req.body });
    });
  });
}

test('accepts an ERP state larger than the previous 1 MB limit', async () => {
  const payload = { collections: [{ id: 'tasks', text: 'a'.repeat(1100000) }] };
  const result = await parse(payload, '50mb');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, payload);
});

test('keeps the configured limit and returns a clear 413 response', async () => {
  const result = await parse({ text: 'a'.repeat(2048) }, '1kb');
  assert.equal(result.status, 413);
  assert.equal(result.body.code, 'PAYLOAD_TOO_LARGE');
});
