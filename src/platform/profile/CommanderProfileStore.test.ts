import { describe, it, expect } from 'vitest';
import { LocalStorageCommanderProfileStore, normalizeCommanderName, PROFILE_SCHEMA_VERSION } from './CommanderProfileStore';
import { STORAGE_KEYS } from '../storage/keys';
import { createMemoryStorage, createThrowingStorage } from '../storage/memoryStorage';

describe('LocalStorageCommanderProfileStore', () => {
  it('returns null when no profile exists', () => {
    const store = new LocalStorageCommanderProfileStore(createMemoryStorage());
    expect(store.getProfile()).toBeNull();
  });

  it('creates a profile with zeroed stats, schemaVersion and timestamps', () => {
    const store = new LocalStorageCommanderProfileStore(createMemoryStorage());
    const p = store.createProfile('Vex');
    expect(p.displayName).toBe('Vex');
    expect(p.totalMatches).toBe(0);
    expect(p.wins).toBe(0);
    expect(p.losses).toBe(0);
    expect(p.bestScore).toBe(0);
    expect(p.schemaVersion).toBe(PROFILE_SCHEMA_VERSION);
    expect(typeof p.id).toBe('string');
    expect(p.id.length).toBeGreaterThan(0);
    expect(p.createdAt).toBeTruthy();
    expect(p.lastPlayedAt).toBeTruthy();
    expect(store.getProfile()?.id).toBe(p.id); // persisted + read back
  });

  it('preferred faction is optional / passed through', () => {
    const store = new LocalStorageCommanderProfileStore(createMemoryStorage());
    expect(store.createProfile('A').preferredFaction).toBeUndefined();
    expect(store.createProfile('B', 'red').preferredFaction).toBe('red');
  });

  it('normalizes names consistently (trim, clamp, empty→Commander)', () => {
    expect(normalizeCommanderName('  Hero  ')).toBe('Hero');
    expect(normalizeCommanderName('')).toBe('Commander');
    expect(normalizeCommanderName('   ')).toBe('Commander');
    expect(normalizeCommanderName('x'.repeat(40)).length).toBe(24);
    const store = new LocalStorageCommanderProfileStore(createMemoryStorage());
    expect(store.createProfile('   ').displayName).toBe('Commander');
  });

  it('updateProfile persists changes', () => {
    const store = new LocalStorageCommanderProfileStore(createMemoryStorage());
    const p = store.createProfile('Vex');
    store.updateProfile({ ...p, wins: 3, bestScore: 9000 });
    expect(store.getProfile()?.wins).toBe(3);
    expect(store.getProfile()?.bestScore).toBe(9000);
  });

  it('renameCommander changes only the name (id + stats preserved)', () => {
    const store = new LocalStorageCommanderProfileStore(createMemoryStorage());
    const p = store.createProfile('Old');
    store.updateProfile({ ...store.getProfile()!, wins: 5 });
    store.renameCommander('New');
    const after = store.getProfile()!;
    expect(after.displayName).toBe('New');
    expect(after.id).toBe(p.id);
    expect(after.wins).toBe(5);
  });

  it('deleteProfile removes ONLY the profile key', () => {
    const storage = createMemoryStorage();
    storage.setItem(STORAGE_KEYS.campaignProgress, '{"playerId":"x","campaigns":{}}');
    storage.setItem(STORAGE_KEYS.localScores, '[]');
    const store = new LocalStorageCommanderProfileStore(storage);
    store.createProfile('Vex');
    store.deleteProfile();
    expect(storage.getItem(STORAGE_KEYS.commanderProfile)).toBeNull();
    expect(storage.getItem(STORAGE_KEYS.campaignProgress)).not.toBeNull();
    expect(storage.getItem(STORAGE_KEYS.localScores)).not.toBeNull();
  });

  it('treats corrupted profile JSON as no profile', () => {
    const storage = createMemoryStorage({ [STORAGE_KEYS.commanderProfile]: '{broken' });
    const store = new LocalStorageCommanderProfileStore(storage);
    expect(store.getProfile()).toBeNull();
  });

  it('createProfile does not crash when the store cannot write', () => {
    const store = new LocalStorageCommanderProfileStore(createThrowingStorage());
    expect(() => store.createProfile('Vex')).not.toThrow();
  });
});
