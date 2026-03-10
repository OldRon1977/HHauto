// Model for a league opponent displayed in the league battle screen.
// Holds the opponent's ID, nickname, power level, and the pre-computed
// battle simulation result used to decide whether to fight.

import { BDSMSimu } from './BDSMSimu';
import { KKLeagueOpponent } from './KK/index';

//@ts-check
export class LeagueOpponent {
    opponent_id: number | string;
    // rank: number;
    nickname: string;
    // level: number;
    power: number;
    // player_league_points: number;
    simuPoints: number;
    // stats= {}; // fill stats if needed
    // nb_boosters: number = 0;
    // kkOpponent:KKLeagueOpponent = {} as any;
    simu:BDSMSimu = {} as any;

    // constructor(opponent_id: any,rank: number,nickname: string,level: number,power: number,player_league_points: number,simuPoints: number,nb_boosters: number, kkOpponent:KKLeagueOpponent, simu:BDSMSimu){
    constructor(opponent_id: number | string, nickname: string, power: number, simuPoints: number, simu:BDSMSimu){
        this.opponent_id = opponent_id;
        // this.rank = rank;
        this.nickname = nickname;
        // this.level = level;
        this.power = power;
        // this.player_league_points = player_league_points;
        this.simuPoints = simuPoints;
        // this.nb_boosters = nb_boosters;
        // this.kkOpponent = kkOpponent;
        this.simu = simu;
    }
}