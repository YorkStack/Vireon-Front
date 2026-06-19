import { describe, it, expect } from 'vitest';
import { savegameFilename } from './savegameUi';

describe('savegameFilename', () => {
  it('uses the date portion of an ISO timestamp', () => {
    expect(savegameFilename('2026-06-19T16:13:44.993Z')).toBe('vireon-savegame-2026-06-19.json');
  });

  it('falls back to a stable name for an empty timestamp', () => {
    expect(savegameFilename('')).toBe('vireon-savegame-export.json');
  });
});
