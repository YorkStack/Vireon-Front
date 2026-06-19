import { describe, it, expect } from 'vitest';
import {
  validateCommanderName, currentCommander, createCommander, renameCommander, deleteCommander,
} from './commanderProfile';
import { LocalStorageCommanderProfileStore } from '../platform/profile/CommanderProfileStore';
import { createMemoryStorage } from '../platform/storage/memoryStorage';

// Inject an in-memory store so the controller logic is tested without a DOM or
// real localStorage (Vitest env is `node`).
const mkStore = () => new LocalStorageCommanderProfileStore(createMemoryStorage());

describe('commander profile UI controller', () => {
  it('reports no commander on first launch', () => {
    expect(currentCommander(mkStore())).toBeNull();
  });

  it('validates names: trims, clamps to 24, rejects empty', () => {
    expect(validateCommanderName('  Vex  ')).toEqual({ ok: true, name: 'Vex' });
    expect(validateCommanderName('')).toMatchObject({ ok: false });
    expect(validateCommanderName('   ')).toMatchObject({ ok: false });
    expect(validateCommanderName('x'.repeat(40)).name.length).toBe(24);
  });

  it('creates a profile from a valid name (shown via currentCommander)', () => {
    const store = mkStore();
    const p = createCommander('Vex', store);
    expect(p?.displayName).toBe('Vex');
    expect(currentCommander(store)?.displayName).toBe('Vex');
  });

  it('does NOT create a profile for an empty name', () => {
    const store = mkStore();
    expect(createCommander('   ', store)).toBeNull();
    expect(currentCommander(store)).toBeNull();
  });

  it('rename updates the displayed name (and rejects empty)', () => {
    const store = mkStore();
    createCommander('Old', store);
    expect(renameCommander('New', store)).toBe(true);
    expect(currentCommander(store)?.displayName).toBe('New');
    expect(renameCommander('  ', store)).toBe(false);
    expect(currentCommander(store)?.displayName).toBe('New'); // unchanged
  });

  it('delete returns to the no-profile (first-launch) state', () => {
    const store = mkStore();
    createCommander('Vex', store);
    deleteCommander(store);
    expect(currentCommander(store)).toBeNull();
  });
});
