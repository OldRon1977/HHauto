// Model for a season (Seasons of Love) opponent.
// Holds the opponent's ID, nickname, mojo/exp/affection rewards,
// and the pre-computed battle simulation result.

import { BDSMSimu } from './BDSMSimu';

export class SeasonOpponent {
    opponent_id: number | string;
    nickname: string;
    mojo: number;
    exp: number;
    aff: number;
    simu: BDSMSimu = {} as BDSMSimu;

    constructor(opponent_id: number | string, nickname: string, mojo: number, exp: number, aff: number, simu: BDSMSimu){
        this.opponent_id = opponent_id;
        this.nickname = nickname;
        this.mojo = mojo;
        this.exp = exp;
        this.aff = aff;
        this.simu = simu;
    }
}