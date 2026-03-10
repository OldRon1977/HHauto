// Raw API model for an energy pool (quest, fight, challenge, kiss, etc.).
// Maps directly to the energy object returned by the game's API responses.

export class KKEnergy {
    amount: number;
    max_regen_amount: number;
    max_amount: number;
    update_ts: number;
    seconds_per_point: number;
    next_refresh_ts: number;
    recharge_time: number;
}