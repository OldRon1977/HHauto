import { LeagueOpponentSnapshot } from '../../src/Service/LeagueOpponentSnapshot';

// One opponents_list entry in the shape the league page serves (anonymised:
// player 1000, no name).
const entry = (history: unknown[]) => ({
    match_history: { 1000: history },
    player: {
        id_fighter: 1000,
        nickname: 'Player_1',
        damage: '212354.47', defense: 67236, remaining_ego: 1197293.14, chance: 114170,
        team: {
            theme_elements: [{ type: 'darkness', ico_url: 'x' }],
            synergies: [{ element: { type: 'sun', ico_url: 'x' }, bonus_multiplier: 0.11 }, { element: { type: 'darkness' }, bonus_multiplier: 0.09 }],
            girls: [{ id_girl: 5, skill_tiers_info: { 1: { skill_points_used: 6 }, 4: { skill_points_used: 5, icon: 'x' }, 5: { skill_points_used: 5 } }, girl: { name: 'x', element_data: { type: 'light' } } }],
        },
    },
});

describe('LeagueOpponentSnapshot.fromListEntry', () => {
    it('keeps what the simulator reads (four synergies) and the open fights, nothing that names a player', () => {
        const rec = LeagueOpponentSnapshot.fromListEntry(entry([{ w: 1 }, null, null]))!;
        expect(rec.openFights).toBe(2);
        expect(rec.player.damage).toBeCloseTo(212354.47);
        expect(rec.player.team.theme_elements).toEqual([{ type: 'darkness' }]);
        expect(rec.player.team.synergies).toEqual([{ element: { type: 'sun' }, bonus_multiplier: 0.11 }]);
        expect(rec.player.team.girls[0]).toEqual({ skill_tiers_info: { 4: { skill_points_used: 5 }, 5: { skill_points_used: 5 } }, girl: { element_data: { type: 'light' } } });
        const text = JSON.stringify(rec);
        expect(text).not.toContain('Player_1');
        expect(text).not.toContain('1000');
    });

    it('reads an opponent fought three times as zero open fights', () => {
        expect(LeagueOpponentSnapshot.fromListEntry(entry([{ w: 1 }, { w: 0 }, { w: 1 }]))!.openFights).toBe(0);
    });

    it('drops an entry without a player', () => {
        expect(LeagueOpponentSnapshot.fromListEntry({})).toBeNull();
    });
});
