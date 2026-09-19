// TeamSelectionPopup.ts -- The team selection popup on the edit-team page.
//
// Six rubrics in three groups, kept visibly apart because they answer
// different questions:
//
//   This week, by stats and blessings -- no opponents. For the hours after
//     the weekly blessing change, when the league has not switched yet.
//   This week, against the league opponents -- the league snapshot, every
//     opponent weighed by the fights still open against him (0-3).
//   Next week, by stats and blessings -- the coming blessings on today's
//     girls.
//
// Each group comes twice: the best team now, and the "possibly best" one --
// every girl projected to full development (level 750, every grade), the
// projection of "Best Possible" (TeamScoringService.scoreBestPossible).
//
// Every rubric can be applied. It saves into the team slot whose edit page
// is open: players who keep more than one team set next week's or a
// development team in a slot of its own.
//
// All rubrics start from the same kind of candidates: the builder's picks
// plus one round of single swaps around the stat-sum pick
// (TeamSelectionService). Position 1 stays with the builder's leader -- the
// Mythic with the Tier-5 Shield -- in every candidate. The game calculates
// every candidate (team_calculate_caracs, the request the edit screen sends
// on every swap). Where the girls are not today's -- next week's blessings,
// full development -- the game cannot calculate them; the stats are then the
// ones measured today plus the fitted effect of the carac change
// (TeamSelectionService.projectCaracs). Measurements are shared between the
// rubrics, so a later rubric pays only for teams not yet measured.
//
// The right-hand column holds Unequip All and Stuff Team, each with the state
// it acts on: the gear on the team, and whether the hexagons match the saved
// team (Stuff Team equips the hexagons, the league fights the saved team).
//
// The actions that live in TeamModule are handed in, so this file does not
// import TeamModule (which opens it).
//
// Depends on: TeamSelectionService.ts, TeamEvaluationService.ts, TeamBuilderService.ts,
//   BlessingForecast.ts, LeagueOpponentSnapshot.ts, AutoLoopHold.ts
// Used by: TeamModule.ts

import { getHHVars } from '../Helper/HHHelper';
import { HeroHelper } from '../Helper/HeroHelper';
import { getTextForUI } from '../Helper/LanguageHelper';
import { BlessingForecast, BlessingsResponse, ForecastCondition, GameTables, RawGirl } from '../Service/BlessingForecast';
import { LeagueOpponentSnapshot, OpponentSnapshot } from '../Service/LeagueOpponentSnapshot';
import { TeamBuilderService } from '../Service/TeamBuilderService';
import { TeamCaracs, TeamEvaluationService } from '../Service/TeamEvaluationService';
import { ElementType, GirlData, PlayerClass, TeamScoringService } from '../Service/TeamScoringService';
import { TeamSelectionService } from '../Service/TeamSelectionService';
import { kickAutoLoop } from '../Service/AutoLoopKick';
import { holdAutoLoop, releaseAutoLoopHold } from '../Service/AutoLoopHold';
import { getStoredValue, setStoredValue } from '../Helper/StorageHelper';
import { HHStoredVarPrefixKey } from '../config/HHStoredVars';
import { TK } from '../config/StorageKeys';
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

interface Rubric {
    id: string;
    group: 'stats' | 'league' | 'next';
    titleKey: string;
    week: 'this' | 'next';
    possible: boolean;
    scoring: 'effective' | 'opponents';
    canApply: boolean;
}

const RUBRICS: Rubric[] = [
    { id: 'S1', group: 'stats',  titleKey: 'teamSelThisStats',          week: 'this', possible: false, scoring: 'effective', canApply: true },
    { id: 'S2', group: 'stats',  titleKey: 'teamSelThisStatsPossible',  week: 'this', possible: true,  scoring: 'effective', canApply: true },
    { id: 'L1', group: 'league', titleKey: 'teamSelThisLeague',         week: 'this', possible: false, scoring: 'opponents', canApply: true },
    { id: 'L2', group: 'league', titleKey: 'teamSelThisLeaguePossible', week: 'this', possible: true,  scoring: 'opponents', canApply: true },
    { id: 'N1', group: 'next',   titleKey: 'teamSelNextStats',          week: 'next', possible: false, scoring: 'effective', canApply: true },
    { id: 'N2', group: 'next',   titleKey: 'teamSelNextStatsPossible',  week: 'next', possible: true,  scoring: 'effective', canApply: true },
];

interface MeasuredCandidate {
    ids: number[];
    caracs: TeamCaracs;
}

interface RubricResult {
    ids: number[];
    caracs: TeamCaracs;
    score: number;
    detail: string;
}

/** The girls one rubric evaluates: today's, and the transformed ones. */
interface Pool {
    today: GirlData[];
    evaluated: GirlData[];
    transformed: boolean;
    info: string;
}

const MEASURE_DELAY_MS = 350;

export class TeamSelectionPopup {

    private static actions: TeamSelectionActions | null = null;
    private static measured = new Map<string, MeasuredCandidate>();
    /** Teams the projection slope is fitted on: today's candidates only. */
    private static calibration: Set<string> | null = null;
    private static results: Record<string, RubricResult> = {};
    private static busy = false;

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
        // The popup is white: the light greens and yellows of the dark team
        // panel are unreadable on it, so every state colour here is a dark one.
        // Sizes are the former ones plus 1pt; the font is the script's own
        // (IBM Plex Sans, set on the popup in HHAuto.template.js).
        GM_addStyle(
            '.hhTeamSelectionPopup #HHAutoPopupGlobalContent{max-width:900px;}'
            + '#hhTeamSel{display:grid;grid-template-columns:1fr 180px;gap:10px;font-size:calc(13px + 1pt);}'
            + '#hhTeamSel .tsGroups{display:flex;flex-direction:column;gap:10px;}'
            + '#hhTeamSel .tsGroup{border-left:6px solid;padding:4px 10px;background:rgba(0,0,0,0.03);display:flex;flex-direction:column;gap:6px;}'
            + '#hhTeamSel .tsGroup-stats{border-color:#4fa3e0;}'
            + '#hhTeamSel .tsGroup-league{border-color:#e0a14f;}'
            + '#hhTeamSel .tsGroup-next{border-color:#9b7fe0;}'
            + '#hhTeamSel .tsRubric + .tsRubric{border-top:1px dashed #999;padding-top:6px;}'
            + '#hhTeamSel .tsRow{display:flex;align-items:center;gap:6px;}'
            + '#hhTeamSel .tsHead{font-weight:bold;font-size:calc(13px + 1pt);flex:1;}'
            + '#hhTeamSel .tsRow .myButton{padding:3px 10px;font-size:calc(12px + 1pt);}'
            + '#hhTeamSel .tsSub{color:#555;font-size:calc(11px + 1pt);}'
            + '#hhTeamSel .tsOut{font-size:calc(12px + 1pt);line-height:1.45;}'
            + '#hhTeamSel .tsGood{color:#1b6e2a;} #hhTeamSel .tsBad{color:#b3261e;} #hhTeamSel .tsWarn{color:#9a5a00;}'
            + '#hhTeamSel .tsSide{display:flex;flex-direction:column;gap:14px;border-left:1px solid #999;padding-left:10px;}'
            + '#hhTeamSel .tsSide .myButton{display:block;text-align:center;padding:6px 4px;font-size:calc(13px + 1pt);}'
            + '#hhTeamSel .tsState{font-size:calc(11px + 1pt);color:#555;margin-top:3px;}'
            + '#hhTeamSel .myButton.tsDisabled{opacity:0.45;pointer-events:none;}'
            + '#hhTeamSel .tsInfo{display:inline-block;width:1.25em;height:1.25em;line-height:1.25em;border-radius:50%;'
            + 'background:#476e9e;color:#fff;text-align:center;font-weight:bold;font-style:italic;cursor:pointer;user-select:none;}'
            + '#hhTeamSel .tsInfoText{border-left:2px solid #476e9e;padding-left:6px;margin-top:2px;}'
        );
    }

    private static rubricHtml(r: Rubric): string {
        return `<div class="tsRubric">
            <div class="tsRow">
                <span class="tsHead">${getTextForUI(r.titleKey, 'elementText')}</span>
                <label class="myButton tsCalc" id="hhTsCalc${r.id}">${getTextForUI('teamSelCalculate', 'elementText')}</label>
                ${r.canApply ? `<label class="myButton tsDisabled" id="hhTsApply${r.id}">${getTextForUI('teamSelApply', 'elementText')}</label>` : ''}
            </div>
            <div class="tsOut" id="hhTsOut${r.id}"></div>
        </div>`;
    }

    private static render(): string {
        // The league rubrics simulate every candidate against every open
        // opponent on top of the game calculation -- a minute or more.
        // The "i" folds the reason open on click rather than as a tooltip:
        // tooltips can be switched off in the menu, and this one matters.
        const hint = (g: Rubric['group']) => g === 'league'
            ? `<div class="tsSub">${getTextForUI('teamSelSlowHint', 'elementText')}`
              + ` <span class="tsInfo" id="hhTsSlowInfoToggle" title="${getTextForUI('teamSelSlowInfo', 'elementText')}">i</span></div>`
              + `<div class="tsSub tsInfoText" id="hhTsSlowInfo" style="display:none">${getTextForUI('teamSelSlowInfo', 'elementText')}</div>`
            : '';
        const group = (g: Rubric['group']) => `<div class="tsGroup tsGroup-${g}">${hint(g)}${RUBRICS.filter(r => r.group === g).map(r => TeamSelectionPopup.rubricHtml(r)).join('')}</div>`;
        return `<div id="hhTeamSel">
            <div class="tsGroups">${group('stats')}${group('league')}${group('next')}</div>
            <div class="tsSide">
                <div>
                    <label class="myButton" id="hhTsUnequip">${getTextForUI('UnequipAll', 'elementText')}</label>
                    <div class="tsState" id="hhTsGearState"></div>
                </div>
                <div>
                    <label class="myButton" id="hhTsStuff">${getTextForUI('StuffTeam', 'elementText')}</label>
                    <div class="tsState" id="hhTsSavedState"></div>
                </div>
            </div>
        </div>`;
    }

    private static bind(): void {
        for (const r of RUBRICS) {
            $('#hhTsCalc' + r.id).on('click', () => { void TeamSelectionPopup.run(r); });
            if (r.canApply) $('#hhTsApply' + r.id).on('click', () => TeamSelectionPopup.apply(r));
        }
        $('#hhTsSlowInfoToggle').on('click', () => $('#hhTsSlowInfo').toggle());
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

    private static out(id: string, html: string): void {
        $('#hhTsOut' + id).html(html);
    }

    private static playerClass(): PlayerClass {
        const rawClass = Number(HeroHelper.getClass());
        return (rawClass === 1 || rawClass === 2 || rawClass === 3) ? rawClass as PlayerClass : 1;
    }

    /** Measure every candidate the cache does not know yet. */
    private static async measureAll(teams: number[][], id: string): Promise<boolean> {
        const battleType = TeamEvaluationService.getBattleType();
        const todo = teams.filter(t => !TeamSelectionPopup.measured.has(TeamSelectionService.teamKey(t)));
        let done = 0;
        for (const team of todo) {
            TeamSelectionPopup.out(id, getTextForUI('teamSelMeasuring', 'elementText')
                .replace('{done}', String(done)).replace('{total}', String(todo.length)));
            // A calculation that does not answer is tried again twice before
            // the rubric gives up -- one slow answer should not cost the
            // hundred calculations before it.
            let result = await TeamEvaluationService.measureTeam(team, battleType);
            for (let retry = 0; !result && retry < 2; retry++) {
                await new Promise(r => setTimeout(r, 2000));
                result = await TeamEvaluationService.measureTeam(team, battleType);
            }
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
        const playerClass = TeamSelectionPopup.playerClass();
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

    /** Next week's league blessings, or an error text for the output line. */
    private static async upcomingConditions(): Promise<{ conditions: ForecastCondition[]; info: string } | string> {
        const ajax = getHHAjax()!;
        const response = await new Promise<BlessingsResponse | null>(resolve => {
            let settled = false;
            setTimeout(() => { if (!settled) { settled = true; resolve(null); } }, 15000);
            ajax({ action: 'get_girls_blessings' }, (data: BlessingsResponse) => { if (!settled) { settled = true; resolve(data); } });
        });
        if (!response || !response.success) return getTextForUI('teamSelNoBlessings', 'elementText');
        const gt: GameTables = (unsafeWindow as unknown as { GT?: GameTables }).GT || {};
        const { conditions, unresolved } = BlessingForecast.upcomingLeagueConditions(response, gt);
        const startsIn = Number(response.upcoming?.[0]?.starts_in) || 0;
        const list = conditions.map(c => `${c.text} +${c.percent} %`).join(', ') || '--';
        const h = Math.floor(startsIn / 3600);
        const when = startsIn > 0 ? ' &middot; ' + getTextForUI('teamSelChangeIn', 'elementText').replace('{d}', String(Math.floor(h / 24))).replace('{h}', String(h % 24)) : '';
        const miss = unresolved.length > 0 ? ` &middot; <span class="tsWarn">${getTextForUI('teamSelUnresolved', 'elementText')}: ${unresolved.join(', ')}</span>` : '';
        return { conditions, info: list + when + miss };
    }

    /** The girls a rubric evaluates. */
    private static async pool(r: Rubric): Promise<Pool | string> {
        const a = TeamSelectionPopup.actions!;
        let raw = TeamSelectionPopup.rawGirls();
        const today = raw.map(g => a.mapGirl(g));
        let info = '';
        if (r.week === 'next') {
            const next = await TeamSelectionPopup.upcomingConditions();
            if (typeof next === 'string') return next;
            raw = raw.map(g => BlessingForecast.projectGirl(g, next.conditions));
            info = next.info;
        }
        if (r.possible) {
            raw = raw.map(g => {
                const f = TeamSelectionService.developmentFactor(a.mapGirl(g));
                const c = g.caracs || { carac1: Number(g.carac1) || 0, carac2: Number(g.carac2) || 0, carac3: Number(g.carac3) || 0 };
                const caracs = { carac1: c.carac1 * f, carac2: c.carac2 * f, carac3: c.carac3 * f };
                return { ...g, caracs, carac1: caracs.carac1, carac2: caracs.carac2, carac3: caracs.carac3 };
            });
        }
        const transformed = r.week === 'next' || r.possible;
        return { today, evaluated: transformed ? raw.map(g => a.mapGirl(g)) : today, transformed, info };
    }

    /**
     * Measure today's candidates once: the fixed set every projection slope
     * is fitted on. Fitted on whatever had been measured, the slope moved
     * with the order the rubrics were run in -- measured live, the same team
     * came out 3 % weaker fully developed than as it is.
     */
    private static async ensureCalibration(today: GirlData[], id: string): Promise<boolean> {
        if (TeamSelectionPopup.calibration) return true;
        const teams = TeamSelectionPopup.candidates(today);
        if (!(await TeamSelectionPopup.measureAll(teams, id))) return false;
        TeamSelectionPopup.calibration = new Set(teams.map(t => TeamSelectionService.teamKey(t)));
        return true;
    }

    /**
     * Slope of each stat against the carac sum, over today's candidates --
     * what projectCaracs adds for girls the game cannot calculate.
     */
    private static fitSlopes(today: GirlData[], harem: Record<ElementType, number>): Partial<Record<keyof TeamCaracs, number | null>> {
        const calibration = TeamSelectionPopup.calibration ?? new Set<string>();
        const samples = [...TeamSelectionPopup.measured.values()].filter(m => calibration.has(TeamSelectionService.teamKey(m.ids))).map(m => {
            const g = TeamSelectionPopup.girlsById(today, m.ids);
            return { m, sums: TeamSelectionService.caracSums(g), counts: TeamSelectionService.countElements(g) };
        });
        const slopes: Partial<Record<keyof TeamCaracs, number | null>> = {};
        for (const stat of ['ego', 'damage', 'defense'] as const) {
            const el = TeamSelectionService.synergyElementOf(stat)!;
            slopes[stat] = TeamSelectionService.fitSumSlope(samples.map(s => ({
                sum: s.sums[0] + s.sums[1] + s.sums[2],
                value: s.m.caracs[stat] / (1 + TeamEvaluationService.getSynergy(s.counts, el, harem)),
            })));
        }
        return slopes;
    }

    // ---- Rubrics ---------------------------------------------------------

    private static async run(r: Rubric): Promise<void> {
        if (TeamSelectionPopup.busy) return;
        if (!TeamSelectionPopup.actions) return;
        if (!getHHAjax()) { TeamSelectionPopup.out(r.id, `<span class="tsBad">${getTextForUI('teamSelNoAjax', 'elementText')}</span>`); return; }
        TeamSelectionPopup.busy = true;
        $('#hhTeamSel .tsCalc').addClass('tsDisabled');
        // Hold the auto-loop for the length of the calculation: a block that
        // navigates away takes the measured candidates with it, and one that
        // sends its own requests competes with a hundred calculations. A
        // reload in between is safe -- the boot path switches the loop back on.
        // Both: the flag stops new ticks, the hold keeps a tick that runs
        // anyway (already scheduled, or kicked by another module) from acting.
        const loopWasOn = getStoredValue(HHStoredVarPrefixKey + TK.autoLoop) === 'true';
        if (loopWasOn) setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, 'false');
        holdAutoLoop('team selection');
        try {
            await TeamSelectionPopup.evaluate(r);
        } catch (err) {
            logHHAuto('Team selection ' + r.id + ' failed: ' + err);
            TeamSelectionPopup.out(r.id, `<span class="tsBad">${String(err)}</span>`);
        } finally {
            TeamSelectionPopup.busy = false;
            $('#hhTeamSel .tsCalc').removeClass('tsDisabled');
            releaseAutoLoopHold();
            if (loopWasOn) {
                setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, 'true');
                kickAutoLoop(Number(getStoredValue(HHStoredVarPrefixKey + TK.autoLoopTimeMili)) || 1000);
            }
        }
    }

    private static async evaluate(r: Rubric): Promise<void> {
        const a = TeamSelectionPopup.actions!;
        let snap: OpponentSnapshot | null = null;
        let info = '';
        if (r.scoring === 'opponents') {
            snap = LeagueOpponentSnapshot.load();
            if (!snap || snap.opponents.every(o => o.openFights === 0)) {
                TeamSelectionPopup.out(r.id, `<span class="tsWarn">${getTextForUI('teamSelNoSnapshot', 'elementText')}</span>`);
                return;
            }
            info = getTextForUI('teamSelSnapshot', 'elementText')
                .replace('{fights}', String(snap.opponents.reduce((s, o) => s + o.openFights, 0)))
                .replace('{opponents}', String(snap.opponents.filter(o => o.openFights > 0).length))
                .replace('{minutes}', String(Math.max(0, Math.round((Date.now() - snap.timestamp) / 60000))));
        }
        const pool = await TeamSelectionPopup.pool(r);
        if (typeof pool === 'string') { TeamSelectionPopup.out(r.id, `<span class="tsBad">${pool}</span>`); return; }
        if (pool.info) info = info ? info + ' &middot; ' + pool.info : pool.info;

        const teams = TeamSelectionPopup.candidates(pool.evaluated);
        if (teams.length === 0) { TeamSelectionPopup.out(r.id, `<span class="tsBad">${getTextForUI('teamSelNoCandidates', 'elementText')}</span>`); return; }
        const current = a.getHexagonIds();
        const withCurrent = current.length === 7 ? [...teams, current] : teams;
        if (!(await TeamSelectionPopup.measureAll(withCurrent, r.id))) {
            TeamSelectionPopup.out(r.id, `<span class="tsBad">${getTextForUI('teamSelMeasureFailed', 'elementText')}</span>`);
            return;
        }

        if (pool.transformed && !(await TeamSelectionPopup.ensureCalibration(pool.today, r.id))) {
            TeamSelectionPopup.out(r.id, `<span class="tsBad">${getTextForUI('teamSelMeasureFailed', 'elementText')}</span>`);
            return;
        }
        const harem = TeamEvaluationService.getHaremSynergies();
        const slopes = pool.transformed ? TeamSelectionPopup.fitSlopes(pool.today, harem) : {};
        const statsOf = (ids: number[]): TeamCaracs => {
            const measured = TeamSelectionPopup.measured.get(TeamSelectionService.teamKey(ids))!.caracs;
            if (!pool.transformed) return measured;
            const today = TeamSelectionPopup.girlsById(pool.today, ids);
            const evaluated = TeamSelectionPopup.girlsById(pool.evaluated, ids);
            return TeamSelectionService.projectCaracs(measured, TeamSelectionService.caracSums(today),
                TeamSelectionService.caracSums(evaluated), TeamSelectionService.countElements(today), harem, slopes);
        };
        const score = async (ids: number[]): Promise<RubricResult> => {
            const caracs = statsOf(ids);
            const teamGirls = TeamSelectionPopup.girlsById(pool.evaluated, ids);
            if (r.scoring === 'effective') {
                return { ids, caracs, score: TeamEvaluationService.computeEffectivePower(caracs, TeamSelectionService.countElements(teamGirls), harem), detail: '' };
            }
            const s = await TeamSelectionService.scoreAgainstOpponentsSliced(TeamSelectionService.buildHeroFighter(caracs, teamGirls, harem), snap!.opponents);
            return { ids, caracs, score: s.points, detail: `${(s.winChance * 100).toFixed(1)} %` };
        };
        // Every candidate is scored, and in the league rubrics every candidate
        // against every opponent with an open fight.
        const scored = teams;

        let best: RubricResult | null = null;
        let done = 0;
        for (const ids of scored) {
            if (r.scoring === 'opponents') {
                TeamSelectionPopup.out(r.id, getTextForUI('teamSelSimulating', 'elementText').replace('{done}', String(done)).replace('{total}', String(scored.length)));
            }
            const s = await score(ids);
            if (!best || s.score > best.score) best = s;
            done++;
        }
        const currentScore = current.length === 7 ? await score(current) : null;
        TeamSelectionPopup.results[r.id] = best!;
        TeamSelectionPopup.out(r.id, TeamSelectionPopup.describe(r, best!, pool.evaluated, currentScore, teams.length, info, pool.transformed));
        if (r.canApply) $('#hhTsApply' + r.id).removeClass('tsDisabled');
        logHHAuto(`Team selection ${r.id}: ${teams.length} candidates, best ${best!.ids.join(',')} score ${best!.score}`);
    }

    // ---- Output ----------------------------------------------------------

    private static describe(r: Rubric, res: RubricResult, girls: GirlData[], current: RubricResult | null,
        candidates: number, info: string, estimated: boolean): string {
        const hex = new Set(TeamSelectionPopup.actions!.getHexagonIds());
        const names = TeamSelectionPopup.girlsById(girls, res.ids).map((g, i) => {
            const label = `${i === 0 ? '&#9733; ' : ''}${g.name} <span class="tsSub">(${g.element}, ${g.rarity})</span>`;
            return hex.has(g.id_girl) ? label : `<b class="tsGood">${label}</b>`;
        }).join('<br/>');
        const caracs = `${getTextForUI('teamSelDamage', 'elementText')} ${Math.round(res.caracs.damage).toLocaleString()} &middot; `
            + `${getTextForUI('teamSelEgo', 'elementText')} ${Math.round(res.caracs.ego).toLocaleString()} &middot; `
            + `${getTextForUI('teamSelDefense', 'elementText')} ${Math.round(res.caracs.defense).toLocaleString()}`;
        const headline = r.scoring === 'opponents'
            ? getTextForUI('teamSelPoints', 'elementText').replace('{points}', res.score.toFixed(0)).replace('{win}', res.detail)
            : getTextForUI('teamSelEff', 'elementText').replace('{eff}', res.score.toExponential(3));
        let delta = '';
        if (current && current.score > 0) {
            const pct = (res.score / current.score - 1) * 100;
            delta = pct > 0.005
                ? ` <span class="tsGood">(+${pct.toFixed(2)} % ${getTextForUI('teamSelVsCurrent', 'elementText')})</span>`
                : ` <span class="tsSub">(${getTextForUI('teamSelIsCurrent', 'elementText')})</span>`;
        }
        const infoLine = info ? `<div class="tsSub">${info}</div>` : '';
        const note = estimated ? `<div class="tsSub">${getTextForUI('teamSelModelNote', 'elementText')}</div>` : '';
        return `${infoLine}<div>${headline}${delta}</div><div class="tsSub">${caracs} &middot; ${candidates} ${getTextForUI('teamSelCandidates', 'elementText')}</div>${note}<div>${names}</div>`;
    }

    // ---- Apply -----------------------------------------------------------

    private static apply(r: Rubric): void {
        const a = TeamSelectionPopup.actions;
        const res = TeamSelectionPopup.results[r.id];
        if (!a || !res || !r.canApply) return;
        $('#hhTsApply' + r.id).addClass('tsDisabled');
        a.saveTeam(res.ids, (ok, message) => {
            const html = ok
                ? `<span class="tsGood">${getTextForUI('teamSelApplied', 'elementText')}</span>`
                : `<span class="tsBad">${getTextForUI('teamSelApplyFailed', 'elementText')}: ${message}</span>`;
            $('#hhTsOut' + r.id).prepend(`<div>${html}</div>`);
            if (!ok) $('#hhTsApply' + r.id).removeClass('tsDisabled');
        });
    }
}
