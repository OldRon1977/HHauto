export class KKPuzzlePieces {
    id_piece: number;
    id_objective: number;
    reward: {
        loot: boolean;
        rewards: [
            {
                type: string,
                value: number | string
            }
        ]
        shards: Record<string, unknown>[]
    };
    reward_unlocked: boolean;
    reward_claimed: boolean;
    objective: {
        id_objective: number;
        identifier: string;
        name: string;
        anchors: Record<string, unknown>;
    };
    current_points: number;
    target_points: number;
}
