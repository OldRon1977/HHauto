// TeamSelectionPopup.ts -- The "Team optimization" popup on the edit-team
// page: the team selection rubrics, and the team's gear.
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
// Mythic with the Tier-5 Shield -- in every candidate.
//
// Every girl is scored without the gear and the skills she holds today, as
// Unequip & Unskill would leave her (BaseStatsService, calculated -- nothing
// is reset), and then with what Stuff Team gives her: Tier 2 in her caracs,
// Tier 3 in the team's damage, Tier 4/5 in the fight simulation
// (SkillModelService). Today's rubrics count the tiers her level and grades
// unlock today, the "possibly best" ones every tier at level 750. Read from
// the game's caracs instead, the team that holds the gear and the skills
// wins every calculation again -- measured, it returned the equipped team.
//
// The team stats come from the team model (TeamSelectionService): fitted
// once per page on teams the game calculates (team_calculate_caracs), then
// evaluated for every candidate without a further request.
//
// The right-hand column holds Unequip All, Unequip & Unskill, Level-up team
// and Stuff Team. Unequip & Unskill takes the gear off and resets the skills
// of every girl in the game -- optional, the calculation does not need it.
// Unequip All and Stuff Team show the state they act on: the gear on the
// team, and whether the hexagons match the saved team (Level-up team and
// Stuff Team work on the hexagon girls, the league fights the saved team).
// Level-up team stands above Stuff Team because skills unlock by grade and
// level.
// Below them the Team gear block, for the hexagon girls: Best gear and
// Possibly best gear (each shows its plan before equipping), and Level-up
// gear, which levels the worn mythics. None of them depends on the saved
// team, so they ask nothing. Unequip All is not repeated there -- it stands
// right above, in the same popup.
//
// Where the stats-and-blessings rubrics find several teams of exactly the same
// score -- girls the team model cannot tell apart -- they take the one Best
// gear can give the most resonance (TeamGearTieBreakService). The league
// rubrics do not: their fight simulation reads the girls' skills, which the
// tie check does not compare. The girl inventory for it is read once per page.
//
// The actions that live in TeamModule are handed in, so this file does not
// import TeamModule (which opens it).
//
// Depends on: TeamSelectionService.ts, TeamEvaluationService.ts, TeamBuilderService.ts,
//   BlessingForecast.ts, BlessingService.ts, SkillModelService.ts, BaseStatsService.ts,
//   LeagueOpponentSnapshot.ts, TeamGearTieBreakService.ts, AutoLoopHold.ts, WorkPause.ts
// Used by: TeamModule.ts

import { getHHVars } from '../Helper/HHHelper';
import { HeroHelper } from '../Helper/HeroHelper';
import { getTextForUI } from '../Helper/LanguageHelper';
import { BlessingForecast, BlessingsResponse, ForecastCondition, GameTables, RawGirl } from '../Service/BlessingForecast';
import { BaseStatsService, Definition } from '../Service/BaseStatsService';
import { BlessingService } from '../Service/BlessingService';
import { SkillHorizon, SkillModelService } from '../Service/SkillModelService';
import { LeagueOpponentSnapshot, OpponentSnapshot } from '../Service/LeagueOpponentSnapshot';
import { TeamBuilderService } from '../Service/TeamBuilderService';
import { TeamCaracs, TeamEvaluationService } from '../Service/TeamEvaluationService';
import { GirlData, PlayerClass, TeamScoringService } from '../Service/TeamScoringService';
import { CalibrationSample, TeamSelectionService, TeamStatModel } from '../Service/TeamSelectionService';
import { GearWearerRaw, TeamGearTieBreakService, TieBreakResult } from '../Service/TeamGearTieBreakService';
import type { GirlGearItem } from '../Service/TeamGearService';
import { kickAutoLoop } from '../Service/AutoLoopKick';
import { holdAutoLoop, releaseAutoLoopHold } from '../Service/AutoLoopHold';
import { touchWorkPause } from '../Service/WorkPause';
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
    /** Info window of "Unequip & Unskill" (TeamModule.buildPrepareCalcPopUp). */
    prepareCalc: () => void;
    /** Grades and levels for the hexagon girls (TeamModule.levelUpTeam);
     *  false when none of them needs any. */
    levelUpTeam: () => boolean;
    stuffTeam: () => void;
    /** Plan and equip the hexagon girls' gear (TeamGear.preview). */
    bestGear: () => void;
    possibleGear: () => void;
    /** Level the hexagon girls' worn mythics (EquipmentGear.previewGirlUpgrade). */
    levelUpGear: () => void;
    /** Every girl item not worn by anyone (TeamGear.fetchInventory); null when unreadable. */
    readGearInventory: () => Promise<GirlGearItem[] | null>;
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

interface RubricResult {
    ids: number[];
    caracs: TeamCaracs;
    score: number;
    detail: string;
}

/** The girls one rubric evaluates. */
interface Pool {
    /** Without gear and skills, with the rubric's level, grades and blessings. */
    base: GirlData[];
    /** The same girls with the Tier-2 stats Stuff Team gives them. */
    evaluated: GirlData[];
    info: string;
}

const MEASURE_DELAY_MS = 350;
/** Miss of the team model on its own calibration teams above which it is fitted once more (normal: under 0.1 %). */
const MODEL_RETRY = 0.005;
/**
 * Miss above which the rubric asks before it calculates: larger than the gap
 * between the script's pick and a good hand-made team (measured 3.5 %), so the
 * pick could be worse than the team the player has.
 */
const MODEL_WARN = 0.05;

export class TeamSelectionPopup {

    private static actions: TeamSelectionActions | null = null;
    /** The team model, fitted once per page (boosters and hero stats are the page's). */
    private static model: TeamStatModel | null = null;
    /** Largest miss of the model on its calibration teams. */
    private static modelMiss = 0;
    /** The player chose to go on despite a large miss (once per page). */
    private static modelAccepted = false;
    private static definitions: Map<number, Definition> | null = null;
    /** The free girl items, read once per page for the gear tie-break. */
    private static inventory: GirlGearItem[] | null = null;
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
            + '#hhTeamSel .tsGear{display:flex;flex-direction:column;gap:6px;border-top:1px solid #999;padding-top:8px;}'
            + '#hhTeamSel .tsGearHead{font-weight:bold;}'
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
            <div class="tsGroups">
                ${group('stats')}${group('league')}${group('next')}
            </div>
            <div class="tsSide">
                <div>
                    <label class="myButton" id="hhTsUnequip">${getTextForUI('UnequipAll', 'elementText')}</label>
                    <div class="tsState" id="hhTsGearState"></div>
                </div>
                <div>
                    <label class="myButton" id="hhTsPrepare" title="${getTextForUI('PrepareCalc', 'tooltip')}">${getTextForUI('PrepareCalc', 'elementText')}</label>
                    <div class="tsState" id="hhTsPrepState"></div>
                </div>
                <div>
                    <label class="myButton" id="hhTsLevelUp" title="${getTextForUI('LevelUpTeam', 'tooltip')}">${getTextForUI('LevelUpTeam', 'elementText')}</label>
                    <div class="tsState" id="hhTsLevelUpState"></div>
                </div>
                <div>
                    <label class="myButton" id="hhTsStuff">${getTextForUI('StuffTeam', 'elementText')}</label>
                    <div class="tsState" id="hhTsSavedState"></div>
                </div>
                <div class="tsGear">
                    <div class="tsGearHead">${getTextForUI('HHTeamGear', 'elementText')}</div>
                    <label class="myButton" id="hhTsBestGear" title="${getTextForUI('HHTeamGearBest', 'tooltip')}">${getTextForUI('HHTeamGearBest', 'elementText')}</label>
                    <label class="myButton" id="hhTsPossibleGear" title="${getTextForUI('HHTeamGearPossible', 'tooltip')}">${getTextForUI('HHTeamGearPossible', 'elementText')}</label>
                    <label class="myButton" id="hhTsLevelUpGear" title="${getTextForUI('HHGirlGearLevelUp', 'tooltip')}">${getTextForUI('HHGirlGearLevelUp', 'elementText')}</label>
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
        $('#hhTsPrepare').on('click', () => TeamSelectionPopup.actions?.prepareCalc());
        // No question before the run (the player asked for none): the
        // tooltip says what it spends.
        $('#hhTsLevelUp').on('click', () => {
            const a = TeamSelectionPopup.actions;
            if (!a) return;
            if (!a.levelUpTeam()) $('#hhTsLevelUpState').html(getTextForUI('levelUpTeamNone', 'elementText'));
        });
        $('#hhTsStuff').on('click', () => {
            const a = TeamSelectionPopup.actions;
            if (!a) return;
            if (!TeamSelectionPopup.hexagonsMatchSaved() && !window.confirm(getTextForUI('teamSelStuffUnsaved', 'elementText'))) return;
            a.stuffTeam();
        });
        $('#hhTsBestGear').on('click', () => TeamSelectionPopup.actions?.bestGear());
        $('#hhTsPossibleGear').on('click', () => TeamSelectionPopup.actions?.possibleGear());
        $('#hhTsLevelUpGear').on('click', () => TeamSelectionPopup.actions?.levelUpGear());
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
        const prep = SkillModelService.prepareSummary(raw);
        $('#hhTsPrepState').html(getTextForUI('prepareCalcState', 'elementText')
            .replace('{gear}', String(prep.withGear)).replace('{skills}', String(prep.withSkills)));
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

    /**
     * Fit the team model once per page: the game calculates a few teams of
     * girls without gear (TeamSelectionService.calibrationTeams), and without
     * Tier 3 where the harem allows -- the Tier-3 model is itself off by up to
     * 0.7 %, and measured live it took the fit from 0.06 % to 1.6 %.
     *
     * A fit that misses its own teams by more than MODEL_RETRY is fitted once
     * more and the better one kept: a booster that runs out during the
     * calibration moves every stat (measured: ego by 18 %). Beyond MODEL_WARN
     * the rubric asks before it calculates (see evaluate); the player can go
     * on anyway, once per page.
     */
    private static async ensureModel(id: string): Promise<'ok' | 'warn' | 'fail'> {
        if (!TeamSelectionPopup.model) {
            let fit = await TeamSelectionPopup.calibrate(id);
            if (!fit) return 'fail';
            if (fit.error > MODEL_RETRY) {
                const second = await TeamSelectionPopup.calibrate(id);
                if (second && second.error < fit.error) fit = second;
            }
            TeamSelectionPopup.model = fit.model;
            TeamSelectionPopup.modelMiss = fit.error;
        }
        return TeamSelectionPopup.modelMiss > MODEL_WARN && !TeamSelectionPopup.modelAccepted ? 'warn' : 'ok';
    }

    /** One calibration: the game calculates the teams, the model is fitted on them. */
    private static async calibrate(id: string): Promise<{ model: TeamStatModel; error: number } | null> {
        const a = TeamSelectionPopup.actions!;
        const noGear = TeamSelectionPopup.rawGirls().filter(g => BaseStatsService.gearPieces(g) === 0);
        const noTier3 = noGear.filter(g => BaseStatsService.tierPoints(g, 3) === 0);
        const raw = noTier3.length >= 7 ? noTier3 : noGear;
        const girls = raw.map(g => a.mapGirl(g));
        const teams = TeamSelectionService.calibrationTeams(girls);
        if (teams.length < 3) return null;
        const battleType = TeamEvaluationService.getBattleType();
        const harem = TeamEvaluationService.getHaremSynergies();
        const samples: CalibrationSample[] = [];
        for (const team of teams) {
            TeamSelectionPopup.out(id, getTextForUI('teamSelMeasuring', 'elementText')
                .replace('{done}', String(samples.length)).replace('{total}', String(teams.length)));
            let result = await TeamEvaluationService.measureTeam(team, battleType);
            for (let retry = 0; !result && retry < 2; retry++) {
                await new Promise(r => setTimeout(r, 2000));
                result = await TeamEvaluationService.measureTeam(team, battleType);
            }
            if (!result) {
                logHHAuto('Team selection: the game calculated no stats for a calibration team, stopping.');
                return null;
            }
            const members = TeamSelectionPopup.girlsById(girls, team);
            samples.push({
                sum: TeamSelectionService.caracSum(members),
                counts: TeamSelectionService.countElements(members),
                tier3: SkillModelService.tier3Bonus(members, g => SkillModelService.currentPoints(g, 3)),
                caracs: result.caracs,
            });
            await new Promise(r => setTimeout(r, MEASURE_DELAY_MS));
        }
        const model = TeamSelectionService.fitTeamModel(samples, harem);
        if (!model) return null;
        const error = TeamSelectionService.modelError(model, samples, harem);
        logHHAuto(`Team selection: team model from ${samples.length} teams, largest miss ${(error * 100).toFixed(2)} %`);
        return { model, error };
    }

    /**
     * Definitions of the girls who carry gear or Tier 2 (BaseStatsService);
     * only the eligible ones, the others never enter a team.
     */
    private static async ensureDefinitions(id: string): Promise<Map<number, Definition>> {
        if (TeamSelectionPopup.definitions) return TeamSelectionPopup.definitions;
        const a = TeamSelectionPopup.actions!;
        const raw = TeamSelectionPopup.rawGirls();
        const eligible = new Set(TeamScoringService.filterEligible(raw.map(g => a.mapGirl(g))).map(g => g.id_girl));
        const needed = BaseStatsService.needingDefinition(raw.filter(g => eligible.has(Number(g.id_girl))));
        const defs = await BaseStatsService.loadDefinitions(needed,
            page => TeamSelectionPopup.out(id, getTextForUI('teamSelReadingHarem', 'elementText').replace('{page}', String(page))));
        TeamSelectionPopup.definitions = defs;
        return defs;
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

    /** Which skill tiers count as filled: today's unlocks, or full development. */
    private static horizon(r: Rubric): SkillHorizon {
        return r.possible ? 'full' : 'now';
    }

    /**
     * The girls a rubric evaluates: without gear and skills, today or fully
     * developed, with this week's or next week's blessings; and with the
     * Tier-2 stats Stuff Team would give them.
     */
    private static async pool(r: Rubric, id: string): Promise<Pool | string> {
        const a = TeamSelectionPopup.actions!;
        const defs = await TeamSelectionPopup.ensureDefinitions(id);
        const horizon = TeamSelectionPopup.horizon(r);
        let raw = TeamSelectionPopup.rawGirls().map(g => BaseStatsService.strip(g, defs.get(Number(g.id_girl)), horizon));
        let info = '';
        if (r.week === 'next') {
            const next = await TeamSelectionPopup.upcomingConditions();
            if (typeof next === 'string') return next;
            raw = raw.map(g => BlessingForecast.projectGirl(g, next.conditions));
            info = next.info;
        }
        const base = raw.map(g => a.mapGirl(g));
        const evaluated = base.map(g => SkillModelService.withTier2(g, horizon, BlessingService.getEffectiveMultiplier(g, 'league')));
        return { base, evaluated, info };
    }

    // ---- Rubrics ---------------------------------------------------------

    private static async run(r: Rubric): Promise<void> {
        if (TeamSelectionPopup.busy) return;
        if (!TeamSelectionPopup.actions) return;
        if (!getHHAjax()) { TeamSelectionPopup.out(r.id, `<span class="tsBad">${getTextForUI('teamSelNoAjax', 'elementText')}</span>`); return; }
        TeamSelectionPopup.busy = true;
        $('#hhTeamSel .tsCalc').addClass('tsDisabled');
        // Hold the auto-loop for the length of the calculation: a block that
        // navigates away takes the calculation with it, and one that sends its
        // own requests competes with the harem list and the calibration. A
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
            // The work pause outlives the hold: the result has yet to be read
            // and applied, and a calculation of many minutes must not have
            // used up the pause's idle time by the time it ends.
            touchWorkPause('a calculation ended');
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
        const modelState = await TeamSelectionPopup.ensureModel(r.id);
        if (modelState === 'fail') {
            TeamSelectionPopup.out(r.id, `<span class="tsBad">${getTextForUI('teamSelMeasureFailed', 'elementText')}</span>`);
            return;
        }
        if (modelState === 'warn') {
            const miss = (TeamSelectionPopup.modelMiss * 100).toFixed(1);
            TeamSelectionPopup.out(r.id, `<div class="tsWarn">${getTextForUI('teamSelModelWarn', 'elementText').replace('{miss}', miss)}</div>`
                + `<label class="myButton" id="hhTsGoOn${r.id}">${getTextForUI('teamSelModelGoOn', 'elementText')}</label>`);
            $('#hhTsGoOn' + r.id).on('click', () => {
                TeamSelectionPopup.modelAccepted = true;
                void TeamSelectionPopup.run(r);
            });
            return;
        }
        const pool = await TeamSelectionPopup.pool(r, r.id);
        if (typeof pool === 'string') { TeamSelectionPopup.out(r.id, `<span class="tsBad">${pool}</span>`); return; }
        if (pool.info) info = info ? info + ' &middot; ' + pool.info : pool.info;

        const teams = TeamSelectionPopup.candidates(pool.evaluated);
        if (r.possible) {
            // The builder picks its candidates from the girls as the rubric
            // sees them; fully developed, other girls look strong, and the
            // pick of "best now" can be missing -- measured, the possibly-best
            // rubric then chose a team its own score put below that pick. Its
            // candidates are added, so the possibly-best team is never below it.
            const now = await TeamSelectionPopup.pool({ ...r, possible: false }, r.id);
            if (typeof now !== 'string') {
                const seen = new Set(teams.map(t => TeamSelectionService.teamKey(t)));
                for (const t of TeamSelectionPopup.candidates(now.evaluated)) {
                    const key = TeamSelectionService.teamKey(t);
                    if (!seen.has(key)) { seen.add(key); teams.push(t); }
                }
            }
        }
        if (teams.length === 0) { TeamSelectionPopup.out(r.id, `<span class="tsBad">${getTextForUI('teamSelNoCandidates', 'elementText')}</span>`); return; }
        const current = a.getHexagonIds();

        const model = TeamSelectionPopup.model!;
        const harem = TeamEvaluationService.getHaremSynergies();
        const horizon = TeamSelectionPopup.horizon(r);
        const statsOf = (ids: number[]): TeamCaracs => {
            const evaluated = TeamSelectionPopup.girlsById(pool.evaluated, ids);
            const base = TeamSelectionPopup.girlsById(pool.base, ids);
            const tier3 = SkillModelService.tier3Bonus(base, g => SkillModelService.targetPoints(g, 3, horizon));
            return TeamSelectionService.modelCaracs(model, TeamSelectionService.caracSum(evaluated), TeamSelectionService.countElements(evaluated), tier3, harem);
        };
        const score = async (ids: number[]): Promise<RubricResult> => {
            const caracs = statsOf(ids);
            const teamGirls = TeamSelectionPopup.girlsById(pool.evaluated, ids);
            if (r.scoring === 'effective') {
                return { ids, caracs, score: TeamEvaluationService.computeEffectivePower(caracs, TeamSelectionService.countElements(teamGirls), harem), detail: '' };
            }
            const baseGirls = TeamSelectionPopup.girlsById(pool.base, ids);
            const tiers = SkillModelService.fightSkillTiers(baseGirls, horizon);
            const fighters = teamGirls.map((g, i) => ({ ...g, skill_tiers_info: tiers[i] }));
            const s = await TeamSelectionService.scoreAgainstOpponentsSliced(TeamSelectionService.buildHeroFighter(caracs, fighters, harem), snap!.opponents);
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
        let tieLine = '';
        if (r.scoring === 'effective' && best) {
            const tie = await TeamSelectionPopup.gearTieBreak(r, best.ids, pool, horizon);
            if (tie && tie.swaps.length > 0) {
                const swapped = await score(tie.ids);
                // The swap partners leave every model input unchanged; the
                // score is compared once more so a drift can never trade
                // strength for resonance.
                if (Math.abs(swapped.score - best.score) <= 1e-9 * Math.abs(best.score)) {
                    best = swapped;
                    tieLine = TeamSelectionPopup.describeTie(tie, pool.evaluated);
                    logHHAuto(`Team selection ${r.id}: same score, Best gear resonance ${tie.before.matches} -> ${tie.after.matches} matches, swapped `
                        + tie.swaps.map(s => `${s.position + 1}: ${s.from} -> ${s.to}`).join(', '));
                } else {
                    logHHAuto(`Team selection ${r.id}: gear tie-break dropped, score ${best.score} -> ${swapped.score}`);
                }
            }
        }
        const currentScore = current.length === 7 ? await score(current) : null;
        TeamSelectionPopup.results[r.id] = best!;
        TeamSelectionPopup.out(r.id, TeamSelectionPopup.describe(r, best!, pool.evaluated, currentScore, teams.length, info, tieLine));
        if (r.canApply) $('#hhTsApply' + r.id).removeClass('tsDisabled');
        logHHAuto(`Team selection ${r.id}: ${teams.length} candidates, best ${best!.ids.join(',')} score ${best!.score}`);
    }

    /**
     * Swaps against girls the team model cannot tell apart, for more
     * resonance with Best gear; null when the girl inventory cannot be read.
     */
    private static async gearTieBreak(r: Rubric, ids: number[], pool: Pool, horizon: SkillHorizon): Promise<TieBreakResult | null> {
        if (!TeamSelectionPopup.inventory) {
            TeamSelectionPopup.out(r.id, getTextForUI('teamSelReadingGear', 'elementText'));
            TeamSelectionPopup.inventory = await TeamSelectionPopup.actions!.readGearInventory();
            if (!TeamSelectionPopup.inventory) {
                logHHAuto('Team selection: the girl equipment could not be read, no gear tie-break');
                return null;
            }
        }
        const raw = TeamSelectionPopup.rawGirls() as unknown as GearWearerRaw[];
        const wearers = new Map(raw.map(g => [Number(g.id_girl), g] as [number, GearWearerRaw]));
        const inventory = TeamGearTieBreakService.unequippedInventory(TeamSelectionPopup.inventory, raw);
        const mode = r.possible ? 'possible' : 'best';
        return TeamGearTieBreakService.improve(ids, pool, horizon,
            team => TeamGearTieBreakService.tally(team, wearers, inventory, mode));
    }

    private static describeTie(tie: TieBreakResult, girls: GirlData[]): string {
        const name = (id: number) => girls.find(g => g.id_girl === id)?.name ?? String(id);
        const swaps = tie.swaps.map(s => `${s.position + 1}. ${name(s.from)} &rarr; ${name(s.to)}`).join(', ');
        return `<div class="tsGood">${getTextForUI('teamSelGearTie', 'elementText')
            .replace('{before}', String(tie.before.matches)).replace('{after}', String(tie.after.matches))
            .replace('{swaps}', swaps)}</div>`;
    }

    // ---- Output ----------------------------------------------------------

    private static describe(r: Rubric, res: RubricResult, girls: GirlData[], current: RubricResult | null,
        candidates: number, info: string, tieLine = ''): string {
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
        // The tie-break line names swaps against the calculation's own pick.
        // When the hexagons already hold the proposed girls, those swaps are
        // done, and the line would ask for them again.
        const otherGirls = TeamSelectionService.teamKey(res.ids) !== TeamSelectionService.teamKey([...hex]);
        if (!otherGirls) tieLine = '';
        let delta = '';
        if (current && current.score > 0) {
            const pct = (res.score / current.score - 1) * 100;
            // As strong as the hexagons but other girls: only the gear
            // tie-break makes that, and then applying it is worth something.
            delta = pct > 0.005
                ? ` <span class="tsGood">(+${pct.toFixed(2)} % ${getTextForUI('teamSelVsCurrent', 'elementText')})</span>`
                : tieLine && otherGirls
                    ? ` <span class="tsGood">(${getTextForUI('teamSelSameMoreResonance', 'elementText')})</span>`
                    : ` <span class="tsSub">(${getTextForUI('teamSelIsCurrent', 'elementText')})</span>`;
        }
        const infoLine = info ? `<div class="tsSub">${info}</div>` : '';
        // Every rubric scores the girls without today's gear and skills; next
        // week and full development also change their blessings or level.
        const model = r.week === 'next' || r.possible ? ` ${getTextForUI('teamSelModelNote', 'elementText')}` : '';
        const note = `<div class="tsSub">${getTextForUI('teamSelSkillNote', 'elementText')}${model}</div>`;
        return `${infoLine}<div>${headline}${delta}</div><div class="tsSub">${caracs} &middot; ${candidates} ${getTextForUI('teamSelCandidates', 'elementText')}</div>${note}${tieLine}<div>${names}</div>`;
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
