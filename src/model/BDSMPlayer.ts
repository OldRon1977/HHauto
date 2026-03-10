// Model for a player in the BDSM (battle simulation) system.
// Holds combat stats (HP, attack, defense, crit, shields, stun, reflect, etc.)
// used by the battle simulator to predict fight outcomes.

//@ts-check
export class BDSMPlayer {
    hp: number;
    atk: number;
    adv_def: number;
    critchance: number;
    bonuses: any; // complex nested game data used in arithmetic
    tier4: any; // complex nested game data used in arithmetic
    tier5: any; // complex nested game data used in arithmetic
    playerShield: number;
    opponentShield: number;
    stunned: number;
    alreadyStunned: number;
    reflect: number;
    critMultiplier: number;
    name:string = '';

    constructor(hp: number, atk: number, adv_def: number, critchance: number, bonuses: any, tier4: any, tier5: any, name=''){
        this.hp = hp;
        this.atk = atk;
        this.adv_def = adv_def;
        this.critchance = critchance;
        this.bonuses = bonuses;
        this.tier4 = tier4;
        this.tier5 = tier5;
        this.name = name;
    }
}
