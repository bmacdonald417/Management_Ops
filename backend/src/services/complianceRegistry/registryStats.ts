import { query } from '../../db/connection.js';

export interface RegistryStats {
  clauseMasterCount: number;
  cyberControlMasterCount: number;
  costAccountCount: number;
  insuranceTierCount: number;
  indemnificationTemplateCount: number;
  clauseMasterMeetsThreshold: boolean;
  cyberControlMeetsThreshold: boolean;
  costAccountExists: boolean;
}

export async function getRegistryStats(): Promise<RegistryStats> {
  let clauseMasterCount = 0;
  let cyberControlMasterCount = 0;
  let costAccountCount = 0;
  let insuranceTierCount = 0;
  let indemnificationTemplateCount = 0;

  try {
    const cm = (await query(`SELECT COUNT(*) as c FROM clause_master`)).rows[0] as { c: string };
    clauseMasterCount = parseInt(cm?.c ?? '0', 10);
  } catch {
    // table may not exist
  }
  try {
    const ccm = (await query(`SELECT COUNT(*) as c FROM cyber_control_master`)).rows[0] as { c: string };
    cyberControlMasterCount = parseInt(ccm?.c ?? '0', 10);
  } catch {
    //
  }
  try {
    const ca = (await query(`SELECT COUNT(*) as c FROM cost_accounts`)).rows[0] as { c: string };
    costAccountCount = parseInt(ca?.c ?? '0', 10);
  } catch {
    //
  }
  try {
    const it = (await query(`SELECT COUNT(*) as c FROM insurance_tiers`)).rows[0] as { c: string };
    insuranceTierCount = parseInt(it?.c ?? '0', 10);
  } catch {
    //
  }
  try {
    const ind = (await query(`SELECT COUNT(*) as c FROM indemnification_templates`)).rows[0] as { c: string };
    indemnificationTemplateCount = parseInt(ind?.c ?? '0', 10);
  } catch {
    //
  }

  return {
    clauseMasterCount,
    cyberControlMasterCount,
    costAccountCount,
    insuranceTierCount,
    indemnificationTemplateCount,
    clauseMasterMeetsThreshold: clauseMasterCount >= 20,
    cyberControlMeetsThreshold: cyberControlMasterCount >= 110,
    costAccountExists: costAccountCount > 0
  };
}
