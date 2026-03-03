//@ts-check
export class BDSMSimu {
    points: number[];
    win: number;
    loss: number;
    scoreClass: string = 'minus'; // 'plus', 'close', 'minus'
    expectedValue: number = 0;

    constructor(points: number[]=[], win= Number.NaN, loss= Number.NaN, scoreClass='minus'){
        this.points = points;
        this.win = win;
        this.loss = loss;
        this.scoreClass = scoreClass;
    }
}
