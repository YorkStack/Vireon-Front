import { describe, it, expect } from 'vitest';
import { importLocalSavegame, parseLocalSavegame } from './importSavegame';
import { buildLocalSavegameExport, serializeLocalSavegame } from './exportSavegame';
import { createMemoryStorage } from '../storage/memoryStorage';
import { STORAGE_KEYS } from '../storage/keys';
import { LocalStorageCommanderProfileStore } from '../profile/CommanderProfileStore';
import { LocalStorageLeaderboardStore } from '../leaderboard/LocalLeaderboardStore';
import type { LocalScoreEntry } from '../leaderboard/types';

const NOW = () => '2026-06-19T12:00:00.000Z';

function score(p: Partial<LocalScoreEntry> = {}): LocalScoreEntry {
  return {
    id: p.id ?? 's1', playerId: 'pl', playerName: 'York', score: p.score ?? 100, victory: true,
    factionId: 'red', difficulty: 'mittel', durationSeconds: 600, createdAt: '2026-06-19T10:00:00.000Z', ...p,
  };
}

/** A source store populated with a profile + one score, plus its exported JSON. */
function makeExport() {
  const src = createMemoryStorage();
  const profileStore = new LocalStorageCommanderProfileStore(src);
  const leaderboardStore = new LocalStorageLeaderboardStore(src);
  profileStore.createProfile('York');
  leaderboardStore.addScore(score());
  return serializeLocalSavegame(buildLocalSavegameExport(src, NOW));
}

describe('importLocalSavegame', () => {
  it('imports a valid savegame into a fresh store', () => {
    const json = makeExport();
    const dest = createMemoryStorage();
    const r = importLocalSavegame(json, dest);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.imported.profile).toBe(true);
      expect(r.imported.scores).toBe(1);
    }
    expect(new LocalStorageCommanderProfileStore(dest).getProfile()?.displayName).toBe('York');
  });

  it('imported scores are readable by LocalLeaderboardStore', () => {
    const json = makeExport();
    const dest = createMemoryStorage();
    importLocalSavegame(json, dest);
    const top = new LocalStorageLeaderboardStore(dest).getTopScores();
    expect(top).toHaveLength(1);
    expect(top[0].playerName).toBe('York');
  });

  it('rejects invalid JSON', () => {
    const r = importLocalSavegame('{not json', createMemoryStorage());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/JSON/);
  });

  it('rejects a wrong format', () => {
    const r = importLocalSavegame(JSON.stringify({ format: 'something-else', version: 1, data: {} }), createMemoryStorage());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Format/i);
  });

  it('rejects an unsupported version', () => {
    const r = importLocalSavegame(JSON.stringify({ format: 'vireon-local-savegame', version: 999, data: {} }), createMemoryStorage());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/Version/i);
  });

  it('does NOT overwrite existing data on a validation failure', () => {
    const dest = createMemoryStorage();
    new LocalStorageCommanderProfileStore(dest).createProfile('Original');
    const before = dest.getItem(STORAGE_KEYS.commanderProfile);

    const r = importLocalSavegame('totally invalid', dest);
    expect(r.ok).toBe(false);
    // Storage untouched → original profile still intact.
    expect(dest.getItem(STORAGE_KEYS.commanderProfile)).toBe(before);
    expect(new LocalStorageCommanderProfileStore(dest).getProfile()?.displayName).toBe('Original');
  });

  it('imports a savegame with empty scores', () => {
    const src = createMemoryStorage();
    new LocalStorageCommanderProfileStore(src).createProfile('York'); // no scores added
    const json = serializeLocalSavegame(buildLocalSavegameExport(src, NOW));
    const dest = createMemoryStorage();
    const r = importLocalSavegame(json, dest);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.imported.scores).toBe(0);
    expect(new LocalStorageLeaderboardStore(dest).getTopScores()).toEqual([]);
  });

  it('a full export → import round-trip preserves profile + scores', () => {
    const json = makeExport();
    const dest = createMemoryStorage();
    importLocalSavegame(json, dest);
    const reexport = JSON.parse(serializeLocalSavegame(buildLocalSavegameExport(dest, NOW)));
    expect(reexport.data.commanderProfile.displayName).toBe('York');
    expect(reexport.data.localScores).toHaveLength(1);
  });
});

describe('parseLocalSavegame', () => {
  it('rejects a missing data object', () => {
    const r = parseLocalSavegame(JSON.stringify({ format: 'vireon-local-savegame', version: 1 }));
    expect(r.ok).toBe(false);
  });

  it('rejects a malformed scores field (object instead of array)', () => {
    const r = parseLocalSavegame(JSON.stringify({ format: 'vireon-local-savegame', version: 1, data: { localScores: { bad: true } } }));
    expect(r.ok).toBe(false);
  });

  it('tolerates absent slices → null profile + empty scores', () => {
    const r = parseLocalSavegame(JSON.stringify({ format: 'vireon-local-savegame', version: 1, data: {} }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.commanderProfile).toBeNull();
      expect(r.data.localScores).toEqual([]);
    }
  });
});
