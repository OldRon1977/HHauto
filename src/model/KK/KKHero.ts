// Raw API model for the player's hero (main character).
// Maps directly to the hero object in the game's API responses, including
// energy pools, character stats, club membership, and equipment.

import { KKEnergy } from "./KKEnergy"

export class KKHero {
    infos: Record<string, unknown>;
    energies: {
        quest: KKEnergy,
        fight: KKEnergy,
        challenge: KKEnergy,
        kiss: KKEnergy,
        worship: KKEnergy,
        reply: KKEnergy
    };
    energy_fields: Record<string, unknown>;
    caracs: Record<string, number>;
    club: Record<string, unknown>;
    currencies: {
        hard_currency: number;
        laby_coin: number;
        rejuvenation_stone: number;
        scrolls_common: number;
        scrolls_epic: number;
        scrolls_legendary: number;
        scrolls_mythic: number;
        scrolls_rare: number;
        seasonal_event_cash: number;
        soft_currency: number;
        sultry_coins: number;
        ticket: number;
    };
    mc_level: number;
    name: string;
    recharge: (...args: unknown[]) => void;
    update: (field: string, value: number, flag: boolean) => void;
    updates: (changes: Record<string, unknown>, flag?: boolean) => void;
}
