// Local data model for the offline Commander Profile (MVP 1).
// NOT authentication, NOT an online account — a local player identity + save
// container, stored in localStorage. See docs/commander-profile-local-storage.md.

export interface CommanderProfile {
  id: string;                  // local id (crypto.randomUUID or local_<ts>_<rand>)
  displayName: string;
  createdAt: string;           // ISO
  lastPlayedAt: string;        // ISO
  preferredFaction?: string;   // 'red' | 'blue' | 'green' | 'yellow' (comfort default)
  totalMatches: number;
  wins: number;
  losses: number;
  bestScore: number;
  schemaVersion: number;       // migration safety
}

export interface CampaignProgress {
  playerId: string;
  campaigns: Record<string, CampaignProgressEntry>; // key = campaignId
}

export interface CampaignProgressEntry {
  unlockedMissionIds: string[];
  completedMissionIds: string[];
  bestScoresByMission: Record<string, number>;
  bestDifficultyByMission: Record<string, string>;
  updatedAt: string;           // ISO
}

export interface LocalGameSettings {
  soundEnabled: boolean;
  musicEnabled: boolean;
  graphicsQuality: 'low' | 'medium' | 'high';
  cameraSpeed: number;
  /** Player-chosen performance/FPS-cap mode. Absent → default 'balanced' (60 FPS). */
  performanceMode?: 'battery' | 'balanced' | 'quality';
}
