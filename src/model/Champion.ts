// Model representing a Champion (boss encounter) in the game.
// Tracks the champion's index, timer state, whether it has been started,
// impression level, filter membership, and associated event girls.

export class ChampionModel {
    index: number;
    timer: number=-1;
    started: boolean=false;
    impression: string;
    inFilter:boolean = false;
    hasEventGirls:boolean = false;

    constructor(index: number, impression: string, inFilter: boolean) {
        this.index = index;
        this.impression = impression;
        this.inFilter = inFilter;
        this.started = impression!="0";
        if (this.started) {
            this.timer = 0;
        }
    }
}