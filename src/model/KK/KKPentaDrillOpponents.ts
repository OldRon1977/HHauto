// Raw API model for a Penta Drill opponent entry.
// Contains the opponent's player info (ID, nickname, power) and
// associated battle rewards.

export class KKPentaDrillOpponents {
    player: {
        id_fighter: number | string;
        nickname: string;
        total_power: number;
    }
    rewards: {
        loot: boolean;
        rewards: Record<string, unknown>[];
        team:{
            value: number | string;
            type: string;
        }[];
    }
}
