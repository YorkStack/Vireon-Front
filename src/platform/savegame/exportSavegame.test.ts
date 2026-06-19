import { describe, it, expect } from 'vitest';
import { buildLocalSavegameExport, serializeLocalSavegame } from './exportSavegame';
import { SAVEGAME_FORMAT, SAVEGAME_VERSION } from './types';
import { createMemoryStorage } from '../storage/memoryStorage';
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

describe('buildLocalSavegameExport', () => {
  it('exports full data with format/version/timestamp', () => {
    const storage = createMemoryStorage();
    const profileStore = new LocalStorageCommanderProfileStore(storage);
    const leaderboardStore = new LocalStorageLeaderboardStore(storage);
    profileStore.createProfile('York');
    leaderboardStore.addScore(score());

    const sg = buildLocalSavegameExport(storage, NOW);
    expect(sg.format).toBe(SAVEGAME_FORMAT);
    expect(sg.version).toBe(SAVEGAME_VERSION);
    expect(sg.exportedAt).toBe('2026-06-19T12:00:00.000Z');
    expect(sg.app).toEqual({ name: 'Vireon Front' });
    expect(sg.data.commanderProfile?.displayName).toBe('York');
    expect(sg.data.localScores).toHaveLength(1);
  });

  it('tolerates a missing profile (null) and still includes an empty scores array', () => {
    const storage = createMemoryStorage();
    const sg = buildLocalSavegameExport(storage, NOW);
    expect(sg.data.commanderProfile).toBeNull();
    expect(sg.data.campaignProgress).toBeNull();
    expect(sg.data.settings).toBeNull();
    expect(sg.data.localScores).toEqual([]);
  });

  it('serializes to pretty JSON with format + version', () => {
    const storage = createMemoryStorage();
    const json = serializeLocalSavegame(buildLocalSavegameExport(storage, NOW));
    expect(json).toContain('\n  "format"'); // 2-space indentation
    const round = JSON.parse(json);
    expect(round.format).toBe(SAVEGAME_FORMAT);
    expect(round.version).toBe(SAVEGAME_VERSION);
  });
});
