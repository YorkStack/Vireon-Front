// A single locally-stored score entry (offline leaderboard, MVP 1).
export interface LocalScoreEntry {
  id: string;                  // local id
  playerId: string;
  playerName: string;          // denormalised → survives later renames
  score: number;
  victory: boolean;
  factionId: string;           // 'red' | 'blue' | 'green' | 'yellow'
  campaignId?: string;
  missionId?: string;
  difficulty: string;          // 'leicht' | 'mittel' | 'schwer' | 'superschwer'
  durationSeconds: number;
  createdAt: string;           // ISO (tie-break: newest first)
}
