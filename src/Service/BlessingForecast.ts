// BlessingForecast.ts -- Next week's league blessings, matched to the girls.
//
// The blessing API sends the coming week along with the current one
// (`upcoming` next to `active`, every week), but only as display text:
// "Eye Color Golden", "Favorite position Doggie style". The girls carry codes
// instead (`eye_color1: "FD0"`, `figure: 1`). The game's own lookup tables in
// `window.GT` hold the same display names for those codes, in the same
// language the description comes in. Measured 2026-09-19 in en, de, fr, es,
// it and ja: every condition ended on exactly one table name, and for the
// running week the girls picked that way were exactly the girls with the
// bonus (2/2, 2/2, 5/5 in every language).
//
// Two rules the data taught:
//   - A colour blessing counts colour 1 OR colour 2. Measured on 1,807 girls:
//     178 carried "Eye Color Golden", 160 by eye_color1, 18 by eye_color2
//     alone, none by neither.
//   - The Role blessing applies in the Love Labyrinth only; the league set
//     (pvp_v3) never contains it. It is dropped here.
//
// Depends on: BlessingService.ts (today's multiplier)
// Used by: TeamSelectionPopup.ts

import { BlessingService } from './BlessingService';

export type ForecastKind = 'eyeColor' | 'hairColor' | 'zodiac' | 'position' | 'rarity' | 'element' | 'role';

export interface ForecastCondition {
    /** Condition text as the game shows it. */
    text: string;
    percent: number;
    kind: ForecastKind;
    /** Girl-side code: colour hex, zodiac key, figure index, rarity, element. */
    code: string;
    /** Display name of the code in the page language (zodiac is matched on it). */
    name: string;
}

/** The parts of an availableGirls entry the matching reads. */
export interface RawGirl {
    eye_color1?: string; eye_color2?: string;
    hair_color1?: string; hair_color2?: string;
    zodiac?: string;
    figure?: number | string;
    position_img?: string;
    rarity?: string;
    element?: string;
    element_data?: { type?: string };
    carac1?: number; carac2?: number; carac3?: number;
    caracs?: { carac1: number; carac2: number; carac3: number };
    blessing_bonuses?: unknown;
    can_be_blessed?: boolean;
    [key: string]: unknown;
}

/** The blessing API answer, as far as the forecast reads it. */
export interface BlessingsResponse {
    success?: boolean;
    upcoming?: { description?: string; starts_in?: number }[];
}

/** The parts of window.GT the matching reads. */
export interface GameTables {
    colors?: Record<string, string>;
    zodiac?: Record<string, string>;
    figures?: string[];
    design?: Record<string, string>;
}

const RARITIES = ['starting', 'common', 'rare', 'epic', 'legendary', 'mythic'];
const ELEMENTS = ['darkness', 'fire', 'light', 'nature', 'psychic', 'stone', 'sun', 'water'];

interface Candidate { kind: ForecastKind; code: string; name: string; prefix?: string }

const norm = (s: unknown): string => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

export class BlessingForecast {

    /** Condition text and bonus percent of one API entry, or null. */
    static parseEntry(entry: { description?: string }): { text: string; percent: number } | null {
        const desc = String(entry?.description ?? '');
        const cond = desc.match(/blessing-condition[^>]*>([^<]+)</i);
        const bonus = desc.match(/blessing-bonus[^>]*>[^0-9<]*(\d+)/i);
        if (!cond || !bonus) return null;
        return { text: cond[1].replace(/\s+/g, ' ').trim(), percent: Number(bonus[1]) };
    }

    private static candidates(gt: GameTables): Candidate[] {
        const d = gt.design || {};
        const out: Candidate[] = [];
        for (const [code, name] of Object.entries(gt.colors || {})) {
            out.push({ kind: 'eyeColor', code, name, prefix: d.haremdex_eye_color });
            out.push({ kind: 'hairColor', code, name, prefix: d.haremdex_hair_color });
        }
        for (const [code, name] of Object.entries(gt.zodiac || {})) {
            out.push({ kind: 'zodiac', code, name, prefix: d.haremdex_zodiac_sign });
        }
        (gt.figures || []).forEach((name, index) => {
            if (index > 0) out.push({ kind: 'position', code: String(index), name });
        });
        for (const r of RARITIES) {
            if (d['girls_rarity_' + r]) out.push({ kind: 'rarity', code: r, name: d['girls_rarity_' + r], prefix: d.selectors_Rarity });
        }
        for (const e of ELEMENTS) {
            if (d[e + '_flavor_element']) out.push({ kind: 'element', code: e, name: d[e + '_flavor_element'], prefix: d.element });
        }
        for (let i = 1; i <= 30; i++) {
            const name = d['girl_role_' + i + '_name'];
            // Unset roles come back as the raw key ("!!HH_design:...!!").
            if (name && !/^!!/.test(name)) out.push({ kind: 'role', code: String(i), name, prefix: d.girl_role });
        }
        return out.filter(c => norm(c.name).length > 0);
    }

    /**
     * Map a condition text onto a girl-side code. The text is "<prefix>
     * <name>"; the longest table name the text ends on wins ("Dark Pink"
     * over "Dark"), and when two kinds share that name -- a colour is both an
     * eye and a hair colour -- the prefix decides. Null when nothing or
     * several things fit.
     */
    static resolve(text: string, percent: number, gt: GameTables): ForecastCondition | null {
        const t = norm(text);
        const byName = BlessingForecast.candidates(gt).filter(c => t === norm(c.name) || t.endsWith(' ' + norm(c.name)));
        if (byName.length === 0) return null;
        const longest = Math.max(...byName.map(c => norm(c.name).length));
        let hits = byName.filter(c => norm(c.name).length === longest);
        if (hits.length > 1) {
            const byPrefix = hits.filter(c => c.prefix && t.startsWith(norm(c.prefix)));
            if (byPrefix.length > 0) hits = byPrefix;
        }
        if (hits.length !== 1) return null;
        const h = hits[0];
        return { text, percent, kind: h.kind, code: h.code, name: h.name };
    }

    /**
     * League-relevant conditions of the coming week. Unresolvable entries
     * are returned separately so the popup can say what it could not read.
     */
    static upcomingLeagueConditions(response: BlessingsResponse | null | undefined, gt: GameTables): { conditions: ForecastCondition[]; unresolved: string[] } {
        const conditions: ForecastCondition[] = [];
        const unresolved: string[] = [];
        for (const entry of Array.isArray(response?.upcoming) ? response.upcoming : []) {
            const parsed = BlessingForecast.parseEntry(entry);
            if (!parsed) continue;
            const cond = BlessingForecast.resolve(parsed.text, parsed.percent, gt);
            if (!cond) { unresolved.push(parsed.text); continue; }
            if (cond.kind === 'role') continue;
            conditions.push(cond);
        }
        return { conditions, unresolved };
    }

    /** Does a raw availableGirls entry meet the condition? */
    static girlMatches(girl: RawGirl, cond: ForecastCondition): boolean {
        switch (cond.kind) {
            case 'eyeColor':  return girl.eye_color1 === cond.code || girl.eye_color2 === cond.code;
            case 'hairColor': return girl.hair_color1 === cond.code || girl.hair_color2 === cond.code;
            case 'zodiac':    return norm(String(girl.zodiac ?? '').replace(/^\S+\s*/, '')) === norm(cond.name);
            case 'position': {
                if (girl.figure !== undefined && girl.figure !== null) return String(girl.figure) === cond.code;
                return String(girl.position_img ?? '').replace(/\.png$/i, '') === cond.code;
            }
            case 'rarity':    return girl.rarity === cond.code;
            case 'element':   return (girl.element_data?.type ?? girl.element) === cond.code;
            default:          return false;
        }
    }

    /** Next week's league multiplier of one girl. */
    static nextMultiplier(girl: RawGirl, conditions: ForecastCondition[]): number {
        let m = 1;
        for (const c of conditions) if (BlessingForecast.girlMatches(girl, c)) m *= 1 + c.percent / 100;
        return m;
    }

    /**
     * A copy of a raw availableGirls entry with next week's caracs: today's
     * league blessing taken out, next week's put in. The copy carries next
     * week's multiplier as its only league blessing, so everything reading
     * blessing_bonuses downstream sees the coming week.
     */
    static projectGirl(girl: RawGirl, conditions: ForecastCondition[]): RawGirl {
        const today = BlessingService.getEffectiveMultiplier(girl as { blessing_bonuses?: unknown }, 'league') || 1;
        const next = BlessingForecast.nextMultiplier(girl, conditions);
        const factor = next / today;
        const caracs = girl.caracs || { carac1: girl.carac1, carac2: girl.carac2, carac3: girl.carac3 };
        const projected = {
            carac1: (Number(caracs.carac1) || 0) * factor,
            carac2: (Number(caracs.carac2) || 0) * factor,
            carac3: (Number(caracs.carac3) || 0) * factor,
        };
        const percents = conditions.filter(c => BlessingForecast.girlMatches(girl, c)).map(c => c.percent);
        return {
            ...girl,
            caracs: projected,
            carac1: projected.carac1,
            carac2: projected.carac2,
            carac3: projected.carac3,
            blessing_bonuses: percents.length > 0 ? { pvp_v3: { carac1: percents, carac2: percents, carac3: percents } } : [],
            can_be_blessed: percents.length > 0,
        };
    }
}
