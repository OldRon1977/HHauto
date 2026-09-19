// TeamSelectionPopup.ts -- The team selection popup on the edit-team page.
//
// Three modes, kept visibly apart because they answer different questions:
//
//   A  This week, by stats and blessings -- no opponents. For the hours after
//      the weekly blessing change, when the league has not switched yet and
//      the opponents' teams describe last week.
//   B  This week, against the open opponents -- the league snapshot, every
//      opponent weighed by the fights still open against him (0-3).
//   C  Next week, by stats -- the coming blessings on today's girls. Display
//      only: a team for next week is weaker this week.
//
// All three start from the same candidates: the builder's picks plus one
// round of single swaps around the stat-sum pick (TeamSelectionService).
// Position 1 stays with the builder's leader -- the Mythic with the Tier-5
// Shield -- in every candidate. The game calculates every candidate
// (team_calculate_caracs, the request the edit screen sends on every swap);
// A ranks by effective power, B by simulated league points, C by effective
// power on the projected stats. Measurements are shared: B and C after A
// cost no new requests for the teams A already measured.
//
// The right-hand column holds Unequip All and Stuff Team, each with the state
// it acts on: the gear on the team, and whether the hexagons match the saved
// team (Stuff Team equips the hexagons, the league fights the saved team).
//
// The actions that live in TeamModule are handed in, so this file does not
// import TeamModule (which opens it).
//
// Depends on: TeamSelectionService.ts, TeamEvaluationService.ts, TeamBuilderService.ts,
//   BlessingForecast.ts, LeagueOpponentSnapshot.ts
// Used by: TeamModule.ts

import { getHHVars } from '../Helper/HHHelper';
import { HeroHelper } from '../Helper/HeroHelper';
import { getTextForUI } from '../Helper/LanguageHelper';
import { BlessingForecast, BlessingsResponse, ForecastCondition, GameTables, RawGirl } from '../Service/BlessingForecast';
import { LeagueOpponentSnapshot } from '../Service/LeagueOpponentSnapshot';
import { TeamBuilderService } from '../Service/TeamBuilderService';
import { TeamCaracs, TeamEvaluationService } from '../Service/TeamEvaluationService';
import { GirlData, PlayerClass, TeamScoringService } from '../Service/TeamScoringService';
import { TeamSelectionService } from '../Service/TeamSelectionService';
import { fillHHPopUp } from '../Utils/HHPopup';
import { logHHAuto } from '../Utils/LogUtils';
import { getHHAjax } from '../Utils/Utils';

export interface TeamSelectionActions {
    /** availableGirls entry -> GirlData (TeamModule.mapAvailableGirl). */
    mapGirl: (raw: RawGirl) => GirlData;
    /** Girl ids in the hexagons, leader first. */
    getHexagonIds: () => number[];
    /** Girl ids of the saved team (as loaded with the page). */
    getSavedIds: () => number[];
    /** Save the given team; reports success or the game's message. */
    saveTeam: (ids: number[], onDone: (ok: boolean, message: string) => void) => void;
    unequipAll: () => void;
    stuffTeam: () => void;
}

type ModeId = 'A' | 'B' | 'C';

interface MeasuredCandidate {
    ids: number[];
    caracs: TeamCaracs;
}

interface ModeResult {
    ids: number[];
    caracs: TeamCaracs;
    score: number;
    detail: string;
}

const MEASURE_DELAY_MS = 350;

export class TeamSelectionPopup {

    private static actions: TeamSelectionActions | null = null;
    private static measured = new Map<string, MeasuredCandidate>();
    private static results: Partial<Record<ModeId, ModeResult>> = {};
    private static busy = false;
    private static cancelled = false;

    static open(actions: TeamSelectionActions): void {
        TeamSelectionPopup.actions = actions;
        TeamSelectionPopup.addStyles();
        fillHHPopUp('hhTeamSelectionPopup', getTextForUI('teamSelTitle', 'elementText'), TeamSelectionPopup.render());
        TeamSelectionPopup.bind();
        TeamSelectionPopup.refreshStatus();
    }

    // ---- Rendering -------------------------------------------------------

    private static stylesAdded = false;
    private static addStyles(): void {
        if (TeamSelectionPopup.stylesAdded) return;
        TeamSelectionPopup.stylesAdded = true;
        GM_addStyle(
            '.hhTeamSelectionPopup #HHAutoPopupGlobalContent{max-width:820px;}'
            + '#hhTeamSel{display:grid;grid-template-columns:1fr 170px;gap:10px;font-size:13px;}'
            + '#hhTeamSel .tsModes{display:flex;flex-direction:column;gap:10px;}'
            + '#hhTeamSel .tsMode{border-left:6px solid;padding:6px 10px;background:rgba(255,255,255,0.04);}'
            + '#hhTeamSel .tsModeA{border-color:#4fa3e0;}'
            + '#hhTeamSel .tsModeB{border-color:#e0a14f;}'
            + '#hhTeamSel .tsModeC{border-color:#9b7fe0;}'
            + '#hhTeamSel .tsHead{font-weight:bold;font-size:14px;margin-bottom:2px;}'
            + '#hhTeamSel .tsSub{color:#aaa;font-size:11px;margin-bottom:4px;}'
            + '#hhTeamSel .tsButtons{display:flex;gap:6px;margin:4px 0;}'
            + '#hhTeamSel .tsButtons .myButton{padding:3px 10px;font-size:12px;}'
            + '#hhTeamSel .tsOut{font-size:12px;line-height:1.45;}'
            + '#hhTeamSel .tsOut .tsGood{color:#7f7;} #hhTeamSel .tsOut .tsBad{color:#f77;} #hhTeamSel .tsOut .tsWarn{color:#fc6;}'
            + '#hhTeamSel .tsSide{display:flex;flex-direction:column;gap:14px;border-left:1px solid #555;padding-left:10px;}'
            + '#hhTeamSel .tsSide .myButton{display:block;text-align:center;padding:6px 4px;}'
            + '#hhTeamSel .tsState{font-size:11px;color:#aaa;margin-top:3px;}'
            + '#hhTeamSel .myButton.tsDisabled{opacity:0.45;pointer-events:none;}'
        );
    }

    private static mode(id: ModeId, titleKey: string, subHtml: string, canApply: boolean): string {
        return `<div class="tsMode tsMode${id}">
            <div class="tsHead">${getTextForUI(titleKey, 'elementText')}</div>
            <div class="tsSub" id="hhTsSub${id}">${subHtml}</div>
            <div class="tsButtons">
                <label class="myButton" id="hhTsCalc${id}">${getTextForUI('teamSelCalculate', 'elementText')}</label>
                ${canApply
                    ? `<label class="myButton tsDisabled" id="hhTsApply${id}">${getTextForUI('teamSelApply', 'elementText')}</label>`
                    : `<span class="tsSub">${getTextForUI('teamSelPreviewOnly', 'elementText')}</span>`}
            </div>
            <div class="tsOut" id="hhTsOut${id}"></div>
        </div>`;
    }

    private static render(): string {
        return `<div id="hhTeamSel">
            <div class="tsModes">
                ${TeamSelectionPopup.mode('A', 'teamSelModeA', getTextForUI('teamSelModeA', 'tooltip'), true)}
                ${TeamSelectionPopup.mode('B', 'teamSelModeB', TeamSelectionPopup.snapshotLine(), true)}
                ${TeamSelectionPopup.mode('C', 'teamSelModeC', getTextForUI('teamSelModeC', 'tooltip'), false)}
            </div>
            <div class="tsSide">
                <div>
                    <label class="myButton" id="hhTsUnequip">${getTextForUI('UnequipAll', 'elementText')}</label>
                    <div class="tsState" id="hhTsGearState"></div>
                </div>
                <div>
                    <label class="myButton" id="hhTsStuff">${getTextForUI('StuffTeam', 'elementText')}</label>
                    <div class="tsState" id="hhTsSavedState"></div>
                </div>
                <div class="tsState">${getTextForUI('teamSelLeaderNote', 'elementText')}</div>
            </div>
        </div>`;
    }

    private static snapshotLine(): string {
        const snap = LeagueOpponentSnapshot.load();
        if (!snap) return `<span class="tsWarn">${getTextForUI('teamSelNoSnapshot', 'elementText')}</span>`;
        const open = snap.opponents.reduce((s, o) => s + o.openFights, 0);
        const withOpen = snap.opponents.filter(o => o.openFights > 0).length;
        const minutes = Math.max(0, Math.round((Date.now() - snap.timestamp) / 60000));
        return getTextForUI('teamSelSnapshot', 'elementText')
            .replace('{fights}', String(open))
            .replace('{opponents}', String(withOpen))
            .replace('{minutes}', String(minutes));
    }

    private static bind(): void {
        (['A', 'B', 'C'] as ModeId[]).forEach(id => {
            $('#hhTsCalc' + id).on('click', () => { void TeamSelectionPopup.run(id); });
            $('#hhTsApply' + id).on('click', () => TeamSelectionPopup.apply(id));
        });
        $('#hhTsUnequip').on('click', () => TeamSelectionPopup.actions?.unequipAll());
        $('#hhTsStuff').on('click', () => {
            const a = TeamSelectionPopup.actions;
            if (!a) return;
            if (!TeamSelectionPopup.hexagonsMatchSaved() && !window.confirm(getTextForUI('teamSelStuffUnsaved', 'elementText'))) return;
            a.stuffTeam();
        });
    }

    private static hexagonsMatchSaved(): boolean {
        const a = TeamSelectionPopup.actions;
        if (!a) return false;
        const hex = a.getHexagonIds();
        const saved = a.getSavedIds();
        return hex.length > 0 && TeamSelectionService.teamKey(hex) === TeamSelectionService.teamKey(saved);
    }

    private static refreshStatus(): void {
        const a = TeamSelectionPopup.actions;
        if (!a) return;
        const raw = TeamSelectionPopup.rawGirls();
        const hex = a.getHexagonIds();
        const pieces = hex.reduce((sum, id) => {
            const g = raw.find(r => Number(r.id_girl) === id);
            const armor = g?.armor as unknown[] | Record<string, unknown> | undefined;
            return sum + (Array.isArray(armor) ? armor.length : (armor ? Object.keys(armor).length : 0));
        }, 0);
        $('#hhTsGearState').html(getTextForUI('teamSelGearState', 'elementText').replace('{pieces}', String(pieces)));
        $('#hhTsSavedState').html(TeamSelectionPopup.hexagonsMatchSaved()
            ? `<span class="tsGood">${getTextForUI('teamSelSaved', 'elementText')}</span>`
            : `<span class="tsWarn">${getTextForUI('teamSelUnsaved', 'elementText')}</span>`);
    }

    // ---- Data ------------------------------------------------------------

    private static rawGirls(): RawGirl[] {
        const raw = getHHVars('availableGirls', false);
        return Array.isArray(raw) ? raw : [];
    }

    private static out(id: ModeId, html: string): void {
        $('#hhTsOut' + id).html(html);
    }

    /** Measure every candidate the cache does not know yet. */
    private static async measureAll(teams: number[][], id: ModeId): Promise<boolean> {
        const battleType = TeamEvaluationService.getBattleType();
        const todo = teams.filter(t => !TeamSelectionPopup.measured.has(TeamSelectionService.teamKey(t)));
        let done = 0;
        for (const team of todo) {
            if (TeamSelectionPopup.cancelled) return false;
            TeamSelectionPopup.out(id, getTextForUI('teamSelMeasuring', 'elementText')
                .replace('{done}', String(done)).replace('{total}', String(todo.length)));
            const result = await TeamEvaluationService.measureTeam(team, battleType);
            if (!result) {
                logHHAuto('Team selection: the game calculated no stats for a candidate, stopping.');
                return false;
            }
            TeamSelectionPopup.measured.set(TeamSelectionService.teamKey(team), { ids: team, caracs: result.caracs });
            done++;
            await new Promise(r => setTimeout(r, MEASURE_DELAY_MS));
        }
        return true;
    }

    /** The builder's candidates plus single swaps around the stat-sum pick. */
    private static candidates(girls: GirlData[]): number[][] {
        const level = Number(HeroHelper.getLevel());
        const rawClass = Number(HeroHelper.getClass());
        const playerClass: PlayerClass = (rawClass === 1 || rawClass === 2 || rawClass === 3) ? rawClass as PlayerClass : 1;
        const built = TeamBuilderService.buildTeamCandidates(girls, 1, level, playerClass);
        if (built.length === 0) return [];
        const base = built[0].girls.map(g => g.id_girl);
        const pool = TeamScoringService.filterEligible(girls, playerClass);
        const all = [...built.map(r => r.girls.map(g => g.id_girl)), ...TeamSelectionService.buildSwapNeighbours(base, pool)];
        const seen = new Set<string>();
        return all.filter(t => {
            const key = TeamSelectionService.teamKey(t);
            if (t.length === 0 || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    private static girlsById(girls: GirlData[], ids: number[]): GirlData[] {
        return ids.map(id => girls.find(g => g.id_girl === id)).filter((g): g is GirlData => !!g);
    }

    // ---- Modes -----------------------------------------------------------

    private static async run(id: ModeId): Promise<void> {
        if (TeamSelectionPopup.busy) return;
        const a = TeamSelectionPopup.actions;
        if (!a) return;
        if (!getHHAjax()) { TeamSelectionPopup.out(id, `<span class="tsBad">${getTextForUI('teamSelNoAjax', 'elementText')}</span>`); return; }
        TeamSelectionPopup.busy = true;
        TeamSelectionPopup.cancelled = false;
        $('#hhTeamSel .tsButtons .myButton').addClass('tsDisabled');
        try {
            if (id === 'C') await TeamSelectionPopup.runNextWeek();
            else await TeamSelectionPopup.runThisWeek(id);
        } catch (err) {
            logHHAuto('Team selection ' + id + ' failed: ' + err);
            TeamSelectionPopup.out(id, `<span class="tsBad">${String(err)}</span>`);
        } finally {
            TeamSelectionPopup.busy = false;
            $('#hhTeamSel .tsButtons .myButton').removeClass('tsDisabled');
            (['A', 'B'] as ModeId[]).forEach(m => { if (!TeamSelectionPopup.results[m]) $('#hhTsApply' + m).addClass('tsDisabled'); });
        }
    }

    private static async runThisWeek(id: 'A' | 'B'): Promise<void> {
        const a = TeamSelectionPopup.actions!;
        const girls = TeamSelectionPopup.rawGirls().map(r => a.mapGirl(r));
        const teams = TeamSelectionPopup.candidates(girls);
        if (teams.length === 0) { TeamSelectionPopup.out(id, `<span class="tsBad">${getTextForUI('teamSelNoCandidates', 'elementText')}</span>`); return; }
        const current = a.getHexagonIds();
        const toMeasure = current.length === 7 ? [...teams, current] : teams;
        const snap = id === 'B' ? LeagueOpponentSnapshot.load() : null;
        if (id === 'B' && (!snap || snap.opponents.every(o => o.openFights === 0))) {
            TeamSelectionPopup.out(id, `<span class="tsWarn">${getTextForUI('teamSelNoSnapshot', 'elementText')}</span>`);
            return;
        }
        if (!(await TeamSelectionPopup.measureAll(toMeasure, id))) {
            TeamSelectionPopup.out(id, `<span class="tsBad">${getTextForUI('teamSelMeasureFailed', 'elementText')}</span>`);
            return;
        }
        const harem = TeamEvaluationService.getHaremSynergies();
        const score = async (ids: number[]): Promise<{ score: number; detail: string }> => {
            const m = TeamSelectionPopup.measured.get(TeamSelectionService.teamKey(ids))!;
            const teamGirls = TeamSelectionPopup.girlsById(girls, ids);
            if (id === 'A') {
                const eff = TeamEvaluationService.computeEffectivePower(m.caracs, TeamSelectionService.countElements(teamGirls), harem);
                return { score: eff, detail: '' };
            }
            const hero = TeamSelectionService.buildHeroFighter(m.caracs, teamGirls, harem);
            const s = TeamSelectionService.scoreAgainstOpponents(hero, snap!.opponents);
            // Yield after each team: a hundred teams against a league is a few
            // seconds of simulation, and the popup should keep painting.
            await new Promise(r => setTimeout(r, 0));
            return { score: s.points, detail: `${(s.winChance * 100).toFixed(1)} %` };
        };
        let best: ModeResult | null = null;
        let done = 0;
        for (const ids of teams) {
            const s = await score(ids);
            if (!best || s.score > best.score) {
                best = { ids, caracs: TeamSelectionPopup.measured.get(TeamSelectionService.teamKey(ids))!.caracs, score: s.score, detail: s.detail };
            }
            done++;
            if (id === 'B' && done % 10 === 0) {
                TeamSelectionPopup.out(id, getTextForUI('teamSelSimulating', 'elementText').replace('{done}', String(done)).replace('{total}', String(teams.length)));
            }
        }
        const currentScore = current.length === 7 ? await score(current) : null;
        TeamSelectionPopup.results[id] = best!;
        TeamSelectionPopup.out(id, TeamSelectionPopup.describe(id, best!, girls, currentScore, teams.length));
        $('#hhTsApply' + id).removeClass('tsDisabled');
        logHHAuto(`Team selection ${id}: ${teams.length} candidates, best ${best!.ids.join(',')} score ${best!.score}`);
    }

    private static async runNextWeek(): Promise<void> {
        const a = TeamSelectionPopup.actions!;
        const ajax = getHHAjax()!;
        const response = await new Promise<BlessingsResponse | null>(resolve => {
            let settled = false;
            setTimeout(() => { if (!settled) { settled = true; resolve(null); } }, 15000);
            ajax({ action: 'get_girls_blessings' }, (data: BlessingsResponse) => { if (!settled) { settled = true; resolve(data); } });
        });
        const gt: GameTables = (unsafeWindow as unknown as { GT?: GameTables }).GT || {};
        const { conditions, unresolved } = BlessingForecast.upcomingLeagueConditions(response, gt);
        if (!response || !response.success) {
            TeamSelectionPopup.out('C', `<span class="tsBad">${getTextForUI('teamSelNoBlessings', 'elementText')}</span>`);
            return;
        }
        const startsIn = Number(response.upcoming?.[0]?.starts_in) || 0;
        $('#hhTsSubC').html(TeamSelectionPopup.blessingLine(conditions, unresolved, startsIn));

        const raw = TeamSelectionPopup.rawGirls();
        const todayGirls = raw.map(r => a.mapGirl(r));
        const nextGirls = raw.map(r => a.mapGirl(BlessingForecast.projectGirl(r, conditions)));
        const teams = TeamSelectionPopup.candidates(nextGirls);
        if (teams.length === 0) { TeamSelectionPopup.out('C', `<span class="tsBad">${getTextForUI('teamSelNoCandidates', 'elementText')}</span>`); return; }
        // Today's stats of the same girls, measured by the game; the fit runs
        // over every team the popup has measured so far.
        if (!(await TeamSelectionPopup.measureAll(teams, 'C'))) {
            TeamSelectionPopup.out('C', `<span class="tsBad">${getTextForUI('teamSelMeasureFailed', 'elementText')}</span>`);
            return;
        }
        const harem = TeamEvaluationService.getHaremSynergies();
        const samples = [...TeamSelectionPopup.measured.values()].map(m => {
            const g = TeamSelectionPopup.girlsById(todayGirls, m.ids);
            return { m, sums: TeamSelectionService.caracSums(g), counts: TeamSelectionService.countElements(g) };
        });
        const slopes: Partial<Record<keyof TeamCaracs, [number, number, number] | null>> = {};
        for (const stat of ['ego', 'damage', 'defense'] as const) {
            const el = TeamSelectionService.synergyElementOf(stat)!;
            slopes[stat] = TeamSelectionService.fitCaracSlopes(samples.map(s => ({
                sums: s.sums,
                value: s.m.caracs[stat] / (1 + TeamEvaluationService.getSynergy(s.counts, el, harem)),
            })));
        }
        let best: ModeResult | null = null;
        for (const ids of teams) {
            const m = TeamSelectionPopup.measured.get(TeamSelectionService.teamKey(ids))!;
            const today = TeamSelectionPopup.girlsById(todayGirls, ids);
            const next = TeamSelectionPopup.girlsById(nextGirls, ids);
            const counts = TeamSelectionService.countElements(today);
            const projected = TeamSelectionService.projectCaracs(m.caracs, TeamSelectionService.caracSums(today), TeamSelectionService.caracSums(next), counts, harem, slopes);
            const eff = TeamEvaluationService.computeEffectivePower(projected, counts, harem);
            if (!best || eff > best.score) best = { ids, caracs: projected, score: eff, detail: '' };
        }
        TeamSelectionPopup.results.C = best!;
        TeamSelectionPopup.out('C', TeamSelectionPopup.describe('C', best!, nextGirls, null, teams.length));
    }

    private static blessingLine(conditions: ForecastCondition[], unresolved: string[], startsInSec: number): string {
        const list = conditions.map(c => `${c.text} +${c.percent} %`).join(', ') || '--';
        const h = Math.floor(startsInSec / 3600);
        const when = startsInSec > 0 ? getTextForUI('teamSelChangeIn', 'elementText').replace('{d}', String(Math.floor(h / 24))).replace('{h}', String(h % 24)) : '';
        const miss = unresolved.length > 0 ? `<br/><span class="tsWarn">${getTextForUI('teamSelUnresolved', 'elementText')}: ${unresolved.join(', ')}</span>` : '';
        return `${list}${when ? ' &middot; ' + when : ''}${miss}`;
    }

    // ---- Output ----------------------------------------------------------

    private static describe(id: ModeId, r: ModeResult, girls: GirlData[], current: { score: number } | null, candidates: number): string {
        const a = TeamSelectionPopup.actions!;
        const hex = new Set(a.getHexagonIds());
        const names = TeamSelectionPopup.girlsById(girls, r.ids).map((g, i) => {
            const isNew = !hex.has(g.id_girl);
            const label = `${i === 0 ? '&#9733; ' : ''}${g.name} <span class="tsSub">(${g.element}, ${g.rarity})</span>`;
            return isNew ? `<b class="tsGood">${label}</b>` : label;
        }).join('<br/>');
        const caracs = `${getTextForUI('teamSelDamage', 'elementText')} ${Math.round(r.caracs.damage).toLocaleString()} &middot; `
            + `${getTextForUI('teamSelEgo', 'elementText')} ${Math.round(r.caracs.ego).toLocaleString()} &middot; `
            + `${getTextForUI('teamSelDefense', 'elementText')} ${Math.round(r.caracs.defense).toLocaleString()}`;
        let headline = '';
        if (id === 'B') {
            headline = getTextForUI('teamSelPoints', 'elementText').replace('{points}', r.score.toFixed(0)).replace('{win}', r.detail);
        } else {
            headline = getTextForUI('teamSelEff', 'elementText').replace('{eff}', r.score.toExponential(3));
        }
        let delta = '';
        if (current && current.score > 0) {
            const pct = (r.score / current.score - 1) * 100;
            delta = pct > 0.005
                ? ` <span class="tsGood">(+${pct.toFixed(2)} % ${getTextForUI('teamSelVsCurrent', 'elementText')})</span>`
                : ` <span class="tsSub">(${getTextForUI('teamSelIsCurrent', 'elementText')})</span>`;
        }
        const note = id === 'C' ? `<div class="tsSub">${getTextForUI('teamSelModelNote', 'elementText')}</div>` : '';
        return `<div>${headline}${delta}</div><div class="tsSub">${caracs} &middot; ${candidates} ${getTextForUI('teamSelCandidates', 'elementText')}</div>${note}<div>${names}</div>`;
    }

    // ---- Apply -----------------------------------------------------------

    private static apply(id: ModeId): void {
        const a = TeamSelectionPopup.actions;
        const r = TeamSelectionPopup.results[id];
        if (!a || !r || id === 'C') return;
        $('#hhTsApply' + id).addClass('tsDisabled');
        a.saveTeam(r.ids, (ok, message) => {
            const html = ok
                ? `<span class="tsGood">${getTextForUI('teamSelApplied', 'elementText')}</span>`
                : `<span class="tsBad">${getTextForUI('teamSelApplyFailed', 'elementText')}: ${message}</span>`;
            $('#hhTsOut' + id).prepend(`<div>${html}</div>`);
            if (!ok) $('#hhTsApply' + id).removeClass('tsDisabled');
        });
    }
}
