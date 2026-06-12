// Campaign / mission loading. Campaigns live under public/campaigns/ as JSON,
// so adding new ones never requires touching game code.
import type { CampaignDef, MissionDef } from '../core/types';

export async function loadCampaignList(): Promise<CampaignDef[]> {
  const idx = await (await fetch('campaigns/index.json')).json() as { campaigns: string[] };
  const out: CampaignDef[] = [];
  for (const id of idx.campaigns) {
    const c = await (await fetch(`campaigns/${id}/campaign.json`)).json() as CampaignDef;
    out.push(c);
  }
  return out;
}

export async function loadMission(campaignId: string, file: string): Promise<MissionDef> {
  return await (await fetch(`campaigns/${campaignId}/${file}`)).json() as MissionDef;
}
