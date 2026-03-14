// Models for in-game missions and their rewards.
// Mission holds the cost, duration, remaining time, completion state,
// and a reference to the DOM element. MissionRewards describes each reward entry.

export class Mission {
    rewards:MissionRewards[];
    finished:boolean = false;
    cost:number;
    duration:number;
    remaining_time:number;
    remaining_cost:number | string;
    missionObject:HTMLElement;
}

export class MissionRewards {
    classList:DOMTokenList;
    type:string = '';
    data:any;
}
