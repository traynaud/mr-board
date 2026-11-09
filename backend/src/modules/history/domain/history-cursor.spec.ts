import { decodeCursor, encodeCursor } from './history-cursor.js';

describe('history cursor', () => {
  it('round-trips a cursor', () => {
    const cursor = { occurredAt: '2026-11-09T10:00:00.000Z', id: 42 };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it.each([
    '',
    'not-a-cursor',
    Buffer.from('2026-11-09|x').toString('base64url'),
    Buffer.from('garbage|12').toString('base64url'),
    Buffer.from('|12').toString('base64url'),
  ])('rejects %p', (token) => {
    expect(decodeCursor(token)).toBeNull();
  });
});
