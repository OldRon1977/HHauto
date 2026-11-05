// BaseStatsService.ts -- The girls as "Unequip & Unskill" would leave them,
// calculated instead of reset.
//
// Why: the team calculation must not prefer a girl for the gear and the
// skills she holds today. Stuff Team and Best gear move both onto whichever
// team is picked; read from the game's caracs, the team that holds them wins
// every calculation again. Measured on a live account: without this, the
// calculation returned the equipped team itself.
//
// What a girl is worth without gear and skills follows from her definition:
//
//   carac = definition carac x level x (1 + 0.3 x grades) / 10 x league blessing
//
// Measured exact to 0.01 on two games (1,681 and 1,826 girls without gear and
// Tier-2 points). Only gear and Tier 2 sit in the caracs on top of that; Tier
// 1, 3, 4 and 5 do not. A girl without either is therefore read back from her
// caracs; only the others need their definition, which availableGirls does
// not carry -- get_girls_list (the harem list, 24 girls per request) does.
// Definitions never change for a girl, so they are kept in storage and
// fetched once.
//
// Depends on: BlessingService.ts (league multiplier), Utils.ts (callGame)
// Used by: TeamSelectionPopup.ts

import { getStoredJSON, setStoredValue } from '../Helper/StorageHelper';
import { HHStoredVarPrefixKey } from '../config/HHStoredVars';
import { TK } from '../config/StorageKeys';
import { logHHAuto } from '../Utils/LogUtils';
import { callGame } from '../Utils/Utils';
import { BlessingService } from './BlessingService';

export type Definition = [number, number, number];

/** 'now': today's level and grades; 'full': level 750 and every grade. */
export type BaseHorizon = 'now' | 'full';

export interface BaseCaracs { carac1: number; carac2: number; carac3: number }

/** The fields of an availableGirls entry this service reads. */
export interface BaseRawGirl {
    id_girl?: unknown;
    level?: unknown;
    graded?: unknown;
    nb_grades?: unknown;
    caracs?: Partial<BaseCaracs>;
    carac1?: unknown; carac2?: unknown; carac3?: unknown;
    armor?: unknown;
    skill_tiers_info?: unknown;
    blessing_bonuses?: unknown;
    [key: string]: unknown;
}

const FULL_LEVEL = 750;
/** Pages of the harem list read at most in one go (24 girls each). */
const MAX_PAGES = 150;
const PAGE_DELAY_MS = 300;

export class BaseStatsService {

    static gearPieces(raw: BaseRawGirl): number {
        const armor = raw.armor;
        if (Array.isArray(armor)) return armor.length;
        return armor && typeof armor === 'object' ? Object.keys(armor).length : 0;
    }

    static tierPoints(raw: BaseRawGirl, tier: number): number {
        const info = raw.skill_tiers_info as Record<string, { skill_points_used?: unknown } | null> | undefined;
        return Number(info?.[String(tier)]?.skill_points_used) || 0;
    }

    /** True when her caracs hold nothing but definition, level, grades and blessing. */
    static isBare(raw: BaseRawGirl): boolean {
        return BaseStatsService.gearPieces(raw) === 0 && BaseStatsService.tierPoints(raw, 2) === 0;
    }

    static levelFactor(level: number, grades: number): number {
        return level * (1 + 0.3 * grades) / 10;
    }

    private static caracsOf(raw: BaseRawGirl): BaseCaracs {
        const c = raw.caracs ?? {};
        return {
            carac1: Number(c.carac1 ?? raw.carac1) || 0,
            carac2: Number(c.carac2 ?? raw.carac2) || 0,
            carac3: Number(c.carac3 ?? raw.carac3) || 0,
        };
    }

    /** A bare girl's definition, read back from her caracs. */
    static definitionFromCaracs(raw: BaseRawGirl): Definition | null {
        const f = BaseStatsService.levelFactor(Number(raw.level) || 0, Number(raw.graded) || 0)
            * BlessingService.getEffectiveMultiplier(raw, 'league');
        if (!(f > 0)) return null;
        const c = BaseStatsService.caracsOf(raw);
        return [c.carac1 / f, c.carac2 / f, c.carac3 / f];
    }

    /** Her caracs without gear and skills, today or fully developed. */
    static baseCaracs(raw: BaseRawGirl, definition: Definition, horizon: BaseHorizon): BaseCaracs {
        const level = horizon === 'full' ? FULL_LEVEL : Number(raw.level) || 0;
        const grades = horizon === 'full' ? Number(raw.nb_grades) || 0 : Number(raw.graded) || 0;
        const f = BaseStatsService.levelFactor(level, grades) * BlessingService.getEffectiveMultiplier(raw, 'league');
        return { carac1: definition[0] * f, carac2: definition[1] * f, carac3: definition[2] * f };
    }

    /**
     * The girl as Unequip & Unskill would leave her: no gear, no skill
     * points, caracs from the definition. Without a definition she stays as
     * she is (and keeps what she holds).
     */
    static strip<T extends BaseRawGirl>(raw: T, definition: Definition | null | undefined, horizon: BaseHorizon): T {
        const def = definition ?? (BaseStatsService.isBare(raw) ? BaseStatsService.definitionFromCaracs(raw) : null);
        if (!def) return raw;
        const caracs = BaseStatsService.baseCaracs(raw, def, horizon);
        const info = (raw.skill_tiers_info ?? {}) as Record<string, Record<string, unknown> | null>;
        const zeroed: Record<string, unknown> = {};
        for (const [tier, t] of Object.entries(info)) zeroed[tier] = t ? { ...t, skill_points_used: 0 } : t;
        return {
            ...raw,
            caracs,
            carac1: caracs.carac1, carac2: caracs.carac2, carac3: caracs.carac3,
            caracs_sum: caracs.carac1 + caracs.carac2 + caracs.carac3,
            armor: [],
            skill_tiers_info: zeroed,
        };
    }

    /** Girls whose definition cannot be read back from their caracs. */
    static needingDefinition(raws: BaseRawGirl[]): number[] {
        return raws.filter(r => !BaseStatsService.isBare(r)).map(r => Number(r.id_girl));
    }

    static storedDefinitions(): Record<string, Definition> {
        return getStoredJSON<Record<string, Definition>>(HHStoredVarPrefixKey + TK.girlDefinitions, {});
    }

    /**
     * Definitions for the given girls: from storage, the missing ones from
     * the harem list. The list is read page by page (owned girls only) until
     * every missing girl is found, or a page brings no girl not seen before --
     * with the owned filter the game reports one page too few, and a page past
     * the end repeats the last one (measured). Every girl a page carries is
     * kept, so a later calculation needs no request.
     */
    static async loadDefinitions(ids: number[], onPage?: (page: number) => void): Promise<Map<number, Definition>> {
        const stored = BaseStatsService.storedDefinitions();
        const missing = new Set(ids.filter(id => !stored[String(id)]));
        if (missing.size > 0) {
            let page = 1;
            let staleInRow = 0;
            const seen = new Set<string>();
            while (missing.size > 0 && page <= MAX_PAGES && staleInRow < 2) {
                if (onPage) onPage(page);
                type Answer = { girls_list?: { id_girl?: unknown; carac1?: unknown; carac2?: unknown; carac3?: unknown }[] };
                const answer = await callGame<Answer>({ action: 'get_girls_list', page, 'filters[shards][]': 100 }, 15000,
                    (err) => logHHAuto('BaseStatsService: get_girls_list failed: ' + err));
                const list = Array.isArray(answer?.girls_list) ? answer!.girls_list : [];
                let fresh = 0;
                for (const g of list) {
                    const id = String(g.id_girl ?? '');
                    if (!id || seen.has(id)) continue;
                    seen.add(id);
                    fresh++;
                    stored[id] = [Number(g.carac1) || 0, Number(g.carac2) || 0, Number(g.carac3) || 0];
                    missing.delete(Number(id));
                }
                staleInRow = fresh === 0 ? staleInRow + 1 : 0;
                if (!answer) break;
                page++;
                await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
            }
            setStoredValue(HHStoredVarPrefixKey + TK.girlDefinitions, JSON.stringify(stored));
            if (missing.size > 0) logHHAuto(`BaseStatsService: no definition for ${missing.size} girls, they keep their gear and skills in the calculation`);
        }
        const out = new Map<number, Definition>();
        for (const id of ids) {
            const def = stored[String(id)];
            if (def) out.set(id, def);
        }
        return out;
    }
}
