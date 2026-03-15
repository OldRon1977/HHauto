/**
 * BDSMHelper.ts - Battle Damage Simulation Model (BDSM)
 *
 * Provides a probabilistic battle simulator that predicts win/loss outcomes
 * for PvP and PvE fights. The simulator models the full combat loop: attack,
 * critical hits, elemental domination bonuses, tier-4/tier-5 girl skills
 * (stun, shield, reflect, execute), and heal-on-hit. It explores every
 * possible crit/non-crit branch per turn, weighting results by probability,
 * to produce an aggregate win chance and expected league-point distribution.
 *
 * Used by League, Season, Troll, and Champion modules to decide whether a
 * fight is worth taking before spending energy.
 *
 * Key concepts:
 *   - "Domination bonuses" come from elemental rock-paper-scissors matchups.
 *   - Tier-4 skills scale damage/defense per turn (compound growth).
 *   - Tier-5 skills are leader-only abilities (stun, shield, reflect, execute).
 *   - The simulation caps at 50 turns to avoid infinite recursion.
 */
import { BDSMPlayer, BDSMSimu } from '../model/index';
import { logHHAuto } from '../Utils/LogUtils';
import { ConfigHelper } from "./ConfigHelper";
import { getStoredJSON } from "./StorageHelper";
import { HHStoredVarPrefixKey } from '../config/index';

export class BDSMHelper {

    /**
     * Elemental advantage lookup tables.
     * - `chance`: elements that grant a crit-chance bonus when facing the listed counter.
     * - `egoDamage`: elements that grant ego (HP) and attack bonuses when facing the listed counter.
     */
    static ELEMENTS =
    {
        chance: {
            darkness: 'light',
            light: 'psychic',
            psychic: 'darkness'
        },
        egoDamage: {
            fire: 'nature',
            nature: 'stone',
            stone: 'sun',
            sun: 'water',
            water: 'fire'
        }
    };

    /**
     * Extract synergy multipliers from a team object. Each element type
     * provides a different combat bonus (crit damage, crit chance, defense
     * reduction, or heal-on-hit).
     */
    static fightBonues(team){
        return {
            critDamage: team.synergies.find(({element: {type}})=>type==='fire').bonus_multiplier,
            critChance: team.synergies.find(({element: {type}})=>type==='stone').bonus_multiplier,
            defReduce: team.synergies.find(({element: {type}})=>type==='sun').bonus_multiplier,
            healOnHit: team.synergies.find(({element: {type}})=>type==='water').bonus_multiplier
        }
    }
        
    /**
     * Build BDSMPlayer models for the player and opponent from raw game data.
     * Applies league-specific domination bonuses when `inLeague` is true,
     * since league fights apply elemental ego/attack bonuses while other
     * modes do not.
     *
     * @returns Object with `player`, `opponent` BDSMPlayer instances
     *          and the computed `dominanceBonuses`.
     */
    static getBdsmPlayersData(inHeroData, opponentData, inLeague=false)
    {
        // player stats
        const playerAtk = inHeroData.damage;
        const playerEgo = inHeroData.remaining_ego;
        const playerDef = inHeroData.defense;
        const playerCrit = inHeroData.chance;
        
        let playerElements:string[] = [];
        inHeroData.team.theme_elements.forEach((el) => playerElements.push(el.type));
        const playerBonuses = BDSMHelper.fightBonues(inHeroData.team);
    
        const opponentAtk = opponentData.damage;
        const opponentEgo = opponentData.remaining_ego;
        const opponentDef = opponentData.defense;
        const opponentCrit = opponentData.chance;
    
        let opponentElements:string[] = [];
        opponentData.team.theme_elements.forEach((el) => opponentElements.push(el.type));
        
        const opponentBonuses = BDSMHelper.fightBonues(opponentData.team);
        const dominanceBonuses = calculateDominationBonuses(playerElements, opponentElements);
    
        const player = new BDSMPlayer(
            inLeague ? playerEgo * (1+dominanceBonuses.player.ego) : playerEgo,
            inLeague ? playerAtk * (1+dominanceBonuses.player.attack) : playerAtk,
            opponentDef,
            calculateCritChanceShare(playerCrit, opponentCrit) + dominanceBonuses.player.chance + playerBonuses.critChance,
            playerBonuses,
            estimateTier4SkillValue(inHeroData.team.girls),
            estimateTier5SkillValue(inHeroData.team.girls),
            inHeroData.nickname
        );
        const opponent = new BDSMPlayer(
            opponentEgo,
            opponentAtk,
            inLeague ? playerDef * (1-opponentBonuses.defReduce) : playerDef,
            calculateCritChanceShare(opponentCrit, playerCrit) + dominanceBonuses.opponent.chance + opponentBonuses.critChance,
            opponentBonuses,
            estimateTier4SkillValue(opponentData.team.girls),
            estimateTier5SkillValue(opponentData.team.girls),
            opponentData.nickname
        );
        return {player:player, opponent:opponent, dominanceBonuses:dominanceBonuses}
    }
}

let _player: BDSMPlayer;
let _opponent: BDSMPlayer;
let _runs;
let _cache;

/**
 * Run a full probabilistic battle simulation between two players.
 *
 * Recursively explores every possible turn outcome (base hit vs. critical hit)
 * for both sides, weighting each branch by its probability. Returns the
 * aggregate win/loss probability and a distribution of expected league points.
 *
 * The simulation caps at 50 turns to prevent stack overflow on stalemate
 * scenarios (e.g., high healing, low damage).
 *
 * @param player   - The attacker (hero) model.
 * @param opponent - The defender model.
 * @param debugEnabled - When true, logs simulation details.
 * @returns BDSMSimu with win/loss probabilities, point distribution, and scoreClass.
 */
export function calculateBattleProbabilities(player: BDSMPlayer, opponent: BDSMPlayer, debugEnabled: boolean = false):BDSMSimu {

    if (debugEnabled) {
        // logHHAuto('Running simulation against' + opponent.name, opponent);
        logHHAuto('Running simulation against' + opponent.name);
    }

    _player = player;
    _opponent = opponent;
    //_cache = {};
    _runs = 0;

    const setup = (x) => {
        x.critMultiplier = 2 + x.bonuses.critDamage;
        x.hp = Math.ceil(x.hp);
    }

    setup(_player);
    setup(_opponent);

    _player.playerShield = (_player.tier5.id == 12) ? _player.tier5.value * player.hp : 0;
    _opponent.opponentShield = 0;

    _player.stunned = 0;
    _player.alreadyStunned = 0;
    _opponent.stunned = (_player.tier5.id == 11) ? 2 : 0;
    _opponent.alreadyStunned = 0;

    _player.reflect = (_player.tier5.id == 13) ? 2 : 0;
    _opponent.reflect = 0;

    let ret;
    try {
        // start simulation from player's turn
        ret = playerTurn(_player.hp, _opponent.hp, _player.playerShield, _opponent.opponentShield, _player.stunned, _opponent.stunned, _player.reflect, _opponent.reflect, 1);
    } catch ({ errName, message }) {
        logHHAuto(`An error occurred during the simulation against ${_opponent.name}`, errName, message);
        return {} as BDSMSimu;
    }

    const sum = ret.win + ret.loss;
    ret.win /= sum;
    ret.loss /= sum;
    ret.scoreClass = ret.win>0.9?'plus':ret.win<0.5?'minus':'close';

    if (debugEnabled) {
        logHHAuto(`Ran ${_runs} simulations against ${_opponent.name}; aggregated win chance: ${ret.win * 100}%`);
    }

    return ret;

    function calculateDmg(x: BDSMPlayer, turns: number) {
        const dmg = x.atk * (1 + x.tier4.dmg) ** turns - x.adv_def * (1 + x.tier4.def) ** turns;

        return {
            baseAtk : {
                probability: 1 - x.critchance,
                damageAmount: Math.ceil(dmg)
            },
            critAtk : {
                probability: x.critchance,
                damageAmount: Math.ceil(dmg * x.critMultiplier)
            }
        }
    }

    function mergeResult(x: BDSMSimu, xProbability: number, y: BDSMSimu, yProbability: number): BDSMSimu {
        const points = {};
        Object.entries(x.points).map(([point, probability]) => [point, probability * xProbability])
            .concat(Object.entries(y.points).map(([point, probability]) => [point, probability * yProbability]))
            .forEach(([point, probability]) => {
            points[point] = (points[point] || 0) + probability
        });

        const win = x.win * xProbability + y.win * yProbability;
        const loss = x.loss * xProbability + y.loss * yProbability;

        return {points, win, loss} as BDSMSimu;
    }

    function playerTurn(playerHP, opponentHP, playerShield, opponentShield, playerStunned, opponentStunned, playerReflect, opponentReflect, turns): BDSMSimu {
        //Avoid a stack overflow
        const maxAllowedTurns = 50;
        if (turns > maxAllowedTurns) throw new Error();

        // read cache
        //const cachedResult = _cache?.[playerHP]?.[opponentHP]
        //if (cachedResult) return cachedResult

        //Simulate base attack and critical attack
        const { baseAtk, critAtk } = calculateDmg(_player, turns);
        const baseAtkResult = playerAttack(playerHP, opponentHP, playerShield, opponentShield, playerStunned, opponentStunned, playerReflect, opponentReflect, baseAtk, turns);
        const critAtkResult = playerAttack(playerHP, opponentHP, playerShield, opponentShield, playerStunned, opponentStunned, playerReflect, opponentReflect, critAtk, turns);

        //Merge result
        const mergedResult = mergeResult(baseAtkResult, baseAtk.probability, critAtkResult, critAtk.probability);

        // write cache
        //if (!_cache[playerHP]) _cache[playerHP] = {}
        //if (!_cache[playerHP][opponentHP]) _cache[playerHP][opponentHP] = {}
        //_cache[playerHP][opponentHP] = mergedResult;

        return mergedResult;
    }

    function playerAttack(playerHP, opponentHP, playerShield, opponentShield, playerStunned, opponentStunned, playerReflect, opponentReflect, attack, turns): BDSMSimu {
        //Player stunned
        if (playerStunned > 0) {
            playerStunned -= 1;

            //Opponent attack
            return opponentTurn(playerHP, opponentHP, playerShield, opponentShield, playerStunned, opponentStunned, playerReflect, opponentReflect, turns);
        }

        //Damage
        let playerDamage = Math.max(0, (attack.damageAmount - opponentShield));
        opponentHP -= playerDamage;
        opponentShield = Math.max(0, opponentShield - attack.damageAmount);

        //Tier 5 skill : Player Execute
        if (_player.tier5.id == 14) {
            let opponentHPRate = opponentHP / _opponent.hp;
            if (opponentHPRate <= _player.tier5.value) opponentHP = 0;
        }

        //Tier 5 skill : Opponent Reflect
        let opponentReflectDmg = (opponentReflect > 0 && opponentHP > 0) ? Math.ceil(_opponent.tier5.value * attack.damageAmount) : 0;
        playerHP -= Math.max(0, (opponentReflectDmg - playerShield));
        playerShield = Math.max(0, playerShield - opponentReflectDmg);
        opponentReflect -= 1;

        //Heal on hit
        let playerHeal = Math.ceil(_player.bonuses.healOnHit * playerDamage);
        playerHP = Math.min(_player.hp, playerHP + playerHeal);

        //Check win
        if (opponentHP <= 0) {
            const point = Math.min(25, 15 + Math.ceil(10 * playerHP / _player.hp));
            _runs += 1;
            return { points: { [point]: 1 }, win: 1, loss: 0 } as BDSMSimu;
        }
        else {
            //Opponent attack
            return opponentTurn(playerHP, opponentHP, playerShield, opponentShield, playerStunned, opponentStunned, playerReflect, opponentReflect, turns);
        }
    }

    function opponentTurn(playerHP, opponentHP, playerShield, opponentShield, playerStunned, opponentStunned, playerReflect, opponentReflect, turns): BDSMSimu {
        if (turns == 1) {
            playerStunned = (_opponent.tier5.id == 11) ? 2 : 0;
            opponentShield = (_opponent.tier5.id == 12) ? (_opponent.tier5.value * _opponent.hp) : 0;
            opponentReflect = (_opponent.tier5.id == 13) ? 2 : 0;
        }

        //Simulate base attack and critical attack
        const { baseAtk, critAtk } = calculateDmg(_opponent, turns);
        const baseAtkResult = opponentAttack(playerHP, opponentHP, playerShield, opponentShield, playerStunned, opponentStunned, playerReflect, opponentReflect, baseAtk, turns);
        const critAtkResult = opponentAttack(playerHP, opponentHP, playerShield, opponentShield, playerStunned, opponentStunned, playerReflect, opponentReflect, critAtk, turns);

        //Merge result
        const mergedResult = mergeResult(baseAtkResult, baseAtk.probability, critAtkResult, critAtk.probability);
        return mergedResult;
    }

    function opponentAttack(playerHP, opponentHP, playerShield, opponentShield, playerStunned, opponentStunned, playerReflect, opponentReflect, attack, turns): BDSMSimu {
        //Opponent stunned
        if (opponentStunned > 0) {
            opponentStunned -= 1;

            //Next turn
            turns += 1;
            return playerTurn(playerHP, opponentHP, playerShield, opponentShield, playerStunned, opponentStunned, playerReflect, opponentReflect, turns);
        }

        //Damage
        let opponentDamage = Math.max(0, (attack.damageAmount - playerShield));
        playerHP -= opponentDamage;
        playerShield = Math.max(0, playerShield - attack.damageAmount);

        //Tier 5 skill : Opponent Execute
        if (_opponent.tier5.id == 14) {
            let playerHPRate = playerHP / _player.hp;
            if (playerHPRate <= _opponent.tier5.value) playerHP = 0;
        }

        //Tier 5 skill : Player Reflect
        let playerReflectDmg = (playerReflect > 0 && playerHP > 0) ? Math.ceil(_player.tier5.value * attack.damageAmount) : 0
        opponentHP -= Math.max(0, (playerReflectDmg - opponentShield));
        opponentShield = Math.max(0, opponentShield - playerReflectDmg);
        playerReflect -= 1;

        //Heal on hit
        let opponentHeal = Math.ceil(_opponent.bonuses.healOnHit * opponentDamage);
        opponentHP = Math.min(_opponent.hp, opponentHP + opponentHeal);

        //Check loss
        if (playerHP <= 0) {
            const point = Math.max(3, 3 + Math.ceil(10 * (_opponent.hp - opponentHP) / _opponent.hp));
            _runs += 1;
            return { points: { [point]: 1 }, win: 0, loss: 1 } as BDSMSimu;
        }
        else {
            //Next turn
            turns += 1;
            return playerTurn(playerHP, opponentHP, playerShield, opponentShield, playerStunned, opponentStunned, playerReflect, opponentReflect, turns);
        }
    }
}

/*function calculateTier4SkillValue(teamGirlsArray): { dmg: number, def: number } {
    let skill_tier_4 = { dmg: 0, def: 0 };

    teamGirlsArray.forEach((girl) => {
        if (girl.skills && girl.skills[9]) skill_tier_4.dmg += girl.skills[9].skill.percentage_value / 100;
        if (girl.skills && girl.skills[10]) skill_tier_4.def += girl.skills[10].skill.percentage_value / 100;
    })
    return skill_tier_4;
}*/
/**
 * Estimate tier-4 skill bonuses from skill_tiers_info.
 * The exact skill data is not always available from the API, so we estimate
 * based on the number of skill points invested (0.2% per point for damage).
 */
function estimateTier4SkillValue(teamGirlsArray): { dmg: number, def: number } {
    let skill_tier_4 = { dmg: 0, def: 0 };

    teamGirlsArray.forEach((girl) => {
            if (girl.skill_tiers_info[4]) skill_tier_4.dmg += girl.skill_tiers_info[4].skill_points_used * 0.002;
        })
    return skill_tier_4;
}

/*const tier5_Skill_Id = [11, 12, 13, 14];
function calculateTier5SkillValue(teamGirlsArray): { id: number, value: number } {
    let skill_tier_5 = { id: 0, value: 0 };
    const girl = teamGirlsArray[0];

    tier5_Skill_Id.forEach((id) => {
        if (girl.skills && girl.skills[id]) {
            skill_tier_5.id = id;
            skill_tier_5.value = (id == 11) ? parseInt(girl.skills[id].skill.display_value_text, 10) / 100 : girl.skills[id].skill.percentage_value / 100;
        }
    })
    return skill_tier_5;
}*/

/**
 * Estimate the tier-5 (leader) skill from the first girl's element.
 * Tier-5 skills are element-dependent:
 *   - sun/darkness  -> Stun (id 11)
 *   - stone/light   -> Shield (id 12)
 *   - psychic/nature -> Reflect (id 13)
 *   - fire/water    -> Execute (id 14)
 * Values are estimated from skill points invested since exact data may be unavailable.
 */
function estimateTier5SkillValue(teamGirlsArray): { id: number, value: number } {
    let skill_tier_5 = { id: 0, value: 0 };
    const girl = teamGirlsArray[0];

    const skill5_girl = girl.skill_tiers_info[5];
    if (skill5_girl) {
        const skill5_girl_element = girl.girl.element_data.type;
        //Stun
        if (skill5_girl_element == 'sun' || skill5_girl_element == 'darkness') {
            skill_tier_5.id = 11;
            skill_tier_5.value = skill5_girl.skill_points_used * 0.07;
        }
        //Shield
        else if (skill5_girl_element == 'stone' || skill5_girl_element == 'light') {
            skill_tier_5.id = 12;
            skill_tier_5.value = skill5_girl.skill_points_used * 0.08;
        }
        //Reflect
        if (skill5_girl_element == 'psychic' || skill5_girl_element == 'nature') {
            skill_tier_5.id = 13;
            skill_tier_5.value = skill5_girl.skill_points_used * 0.2;
        }
        //Execute
        if (skill5_girl_element == 'fire' || skill5_girl_element == 'water') {
            skill_tier_5.id = 14;
            skill_tier_5.value = skill5_girl.skill_points_used * 0.08;
        }
    }
    return skill_tier_5;
}

/*
commented        const girlDictionary
replaced         const girlCount = girlDictionary.size || 800
              by const girlCount = isJSON(getStoredValue(HHStoredVarPrefixKey+TK.HaremSize"))?JSON.parse(getStoredValue(HHStoredVarPrefixKey+TK.HaremSize")).count:800;
              *
export function calculateSynergiesFromTeamMemberElements(elements) {
    const counts = countElementsInTeam(elements)

    // Only care about those not included in the stats already: fire, stone, sun and water
    // Assume max harem synergy
    //const girlDictionary = (typeof(localStorage.HHPNMap) == "undefined") ? new Map(): new Map(JSON.parse(localStorage.HHPNMap));
    const girlCount = getStoredJSON(HHStoredVarPrefixKey+TK.HaremSize", {count:800}).count;
    const girlsPerElement = Math.min(girlCount / 8, 100)

    return {
        critDamage: (0.0035 * girlsPerElement) + (0.1  * counts.fire),
        critChance: (0.0007 * girlsPerElement) + (0.02 * counts.stone),
        defReduce:  (0.0007 * girlsPerElement) + (0.02 * counts.sun),
        healOnHit:  (0.001  * girlsPerElement) + (0.03 * counts.water)
    }
}
*/
/*
replaced       ELEMENTS
by ConfigHelper.getHHScriptVars("ELEMENTS")
*/
/**
 * Calculate elemental domination bonuses for both sides.
 * Each element on team A that dominates a matching element on team B
 * grants +10% ego, +10% attack, or +20% crit chance depending on the
 * advantage type (egoDamage vs. chance).
 */
export function calculateDominationBonuses(playerElements, opponentElements) {
    const bonuses = {
        player: {
            ego: 0,
            attack: 0,
            chance: 0
        },
        opponent: {
            ego: 0,
            attack: 0,
            chance: 0
        }
    };

    [
        {a: playerElements, b: opponentElements, k: 'player'},
        {a: opponentElements, b: playerElements, k: 'opponent'}
    ].forEach(({a,b,k})=>{
        a.forEach(element => {
            if (BDSMHelper.ELEMENTS.egoDamage[element] && b.includes(BDSMHelper.ELEMENTS.egoDamage[element])) {
                bonuses[k].ego += 0.1
                bonuses[k].attack += 0.1
            }
            if (BDSMHelper.ELEMENTS.chance[element] && b.includes(BDSMHelper.ELEMENTS.chance[element])) {
                bonuses[k].chance += 0.2
            }
        })
    })

    return bonuses
}

/**
 * Calculate the base crit chance from the harmony stat ratio.
 * Crit chance is 30% of the player's share of total harmony.
 */
export function calculateCritChanceShare(ownHarmony, otherHarmony)
{
    return 0.3*ownHarmony/(ownHarmony+otherHarmony)
}

/**
 * Sum a specific skill's percentage_value across all girls in a team.
 * Returns 1 + (total percentage / 100), suitable for use as a multiplier.
 */
export function getSkillPercentage(team, id) {
    return 1 + (team.girls.map(e => e.skills[id]?.skill.percentage_value ?? 0).reduce((a, b) => a + b, 0) / 100);
}