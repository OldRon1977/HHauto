// LeagueOpponentSnapshot.ts -- The league opponents, kept for the edit-team
// page.
//
// The team selection against the open opponents runs on the edit-team page,
// and `opponents_list` exists only on the league page. Every visit to the
// league page therefore writes a snapshot: per opponent the four numbers the
// simulator reads, the team theme, synergies and skill tiers -- and how many
// of his three fights are still open. Nothing that names a player is kept.
//
// The snapshot ages with every fight fought after it; the popup shows its
// age, and a new league visit replaces it.
//
// Depends on: TeamSelectionService.ts (SnapshotOpponent, openFights)
// Used by: AutoLoopPageHandlers.ts (writes it), TeamSelectionPopup.ts (reads it)

import { getHHVars } from '../Helper/HHHelper';
import { HeroHelper } from '../Helper/HeroHelper';
import { getStoredJSON, setStoredValue } from '../Helper/StorageHelper';
import { HHStoredVarPrefixKey } from '../config/HHStoredVars';
import { TK } from '../config/StorageKeys';
import { SkillTiers, SnapshotOpponent, TeamSelectionService } from './TeamSelectionService';

export interface OpponentSnapshot {
    timestamp: number;
    /** When the league the snapshot belongs to ends (ms), 0 when unknown. */
    leagueEndsAt: number;
    opponents: SnapshotOpponent[];
}

// The simulator reads the synergy of these four elements only
// (BDSMHelper.fightBonues); the other four are already inside the stats.
const SIMULATED_SYNERGIES = ['fire', 'stone', 'sun', 'water'];

// A league runs one week; without a known end, a snapshot older than that
// describes another league.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** The parts of an opponents_list entry the snapshot reads. */
interface ListEntry {
    match_history?: Record<string, unknown[]>;
    player?: {
        id_fighter?: number | string;
        damage?: unknown; defense?: unknown; remaining_ego?: unknown; chance?: unknown;
        team?: {
            theme_elements?: { type?: unknown }[];
            synergies?: { element?: { type?: unknown }; bonus_multiplier?: unknown }[];
            girls?: { skill_tiers_info?: SkillTiers; element?: unknown; girl?: { element_data?: { type?: unknown } } }[];
        };
    };
}

export class LeagueOpponentSnapshot {

    /** Only the tiers the simulator reads (4 = damage passive, 5 = leader skill). */
    private static stripTiers(info: SkillTiers | undefined): SkillTiers {
        const out: SkillTiers = {};
        for (const tier of ['4', '5']) {
            const t = info?.[tier];
            if (t) out[tier] = { skill_points_used: Number(t.skill_points_used) || 0 };
        }
        return out;
    }

    /** Pure: one opponents_list entry -> the snapshot record, or null. */
    static fromListEntry(entry: ListEntry | null | undefined): SnapshotOpponent | null {
        const p = entry?.player;
        if (!p || !p.team) return null;
        const history = entry?.match_history && p.id_fighter !== undefined ? entry.match_history[String(p.id_fighter)] : undefined;
        return {
            openFights: TeamSelectionService.openFights(history),
            player: {
                damage: Number(p.damage) || 0,
                defense: Number(p.defense) || 0,
                remaining_ego: Number(p.remaining_ego) || 0,
                chance: Number(p.chance) || 0,
                team: {
                    theme_elements: (p.team.theme_elements || []).map(e => ({ type: String(e?.type ?? '') })),
                    synergies: (p.team.synergies || []).filter(s => SIMULATED_SYNERGIES.includes(String(s?.element?.type))).map(s => ({
                        element: { type: String(s?.element?.type ?? '') },
                        bonus_multiplier: Number(s?.bonus_multiplier) || 0,
                    })),
                    girls: (p.team.girls || []).map(g => ({
                        skill_tiers_info: LeagueOpponentSnapshot.stripTiers(g?.skill_tiers_info),
                        girl: { element_data: { type: String(g?.girl?.element_data?.type ?? g?.element ?? '') } },
                    })),
                },
            },
        };
    }

    /**
     * League page: write the snapshot from opponents_list. `leagueEndsInSec`
     * is the league timer (LeagueHelper.getLeagueEndTime), passed in so this
     * file does not pull the league module in. False when the list is not
     * on the page (yet).
     */
    static capture(leagueEndsInSec: number = -1): boolean {
        const list: ListEntry[] | undefined = getHHVars('opponents_list', false);
        if (!Array.isArray(list) || list.length === 0) return false;
        const me = Number(HeroHelper.getPlayerId());
        const opponents = list
            .filter(entry => Number(entry?.player?.id_fighter) !== me)
            .map(entry => LeagueOpponentSnapshot.fromListEntry(entry))
            .filter((o: SnapshotOpponent | null): o is SnapshotOpponent => o !== null);
        if (opponents.length === 0) return false;
        const now = Date.now();
        const snapshot: OpponentSnapshot = {
            timestamp: now,
            leagueEndsAt: leagueEndsInSec > 0 ? now + leagueEndsInSec * 1000 : 0,
            opponents,
        };
        setStoredValue(HHStoredVarPrefixKey + TK.leagueOpponentSnapshot, JSON.stringify(snapshot));
        return true;
    }

    /** The stored snapshot, or null when there is none or it is from another league. */
    static load(now: number = Date.now()): OpponentSnapshot | null {
        const snap = getStoredJSON<OpponentSnapshot | null>(HHStoredVarPrefixKey + TK.leagueOpponentSnapshot, null);
        if (!snap || !Array.isArray(snap.opponents) || typeof snap.timestamp !== 'number') return null;
        if (snap.leagueEndsAt > 0 && now > snap.leagueEndsAt) return null;
        if (now - snap.timestamp > MAX_AGE_MS) return null;
        return snap;
    }
}
