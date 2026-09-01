// Model for a league opponent displayed in the league battle screen.
// Holds the opponent's ID, nickname, power level, and the pre-computed
// battle simulation result used to decide whether to fight.

import { BDSMSimu } from './BDSMSimu';
import { KKLeagueOpponent } from "./KK/KKLeagueOpponent";

//@ts-check
export class LeagueOpponent {
    opponent_id: number | string;
    // rank: number;
    nickname: string;
    // level: number;
    power: number;
    // player_league_points: number;
    simuPoints: number;
    // nb_boosters: number = 0;
    // kkOpponent:KKLeagueOpponent = {} as any;
    simu:BDSMSimu = {} as any;

    // constructor(opponent_id: any,rank: number,nickname: string,level: number,power: number,player_league_points: number,simuPoints: number,nb_boosters: number, kkOpponent:KKLeagueOpponent, simu:BDSMSimu){
    constructor(opponent_id: number | string, nickname: string, power: number, simuPoints: number, simu:BDSMSimu){
        this.opponent_id = opponent_id;
        this.nickname = nickname;
        this.power = power;
        this.simuPoints = simuPoints;
        this.simu = simu;
    }
}