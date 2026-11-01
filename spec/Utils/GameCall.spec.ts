/**
 * Holds what the two timed hh_ajax wrappers do today: the answer on success,
 * null on the error callback, on a throw and after their timeout -- 20 s for
 * TeamGear, 15 s for the team measurement.
 */
import { TeamGear } from "../../src/Module/TeamGear";
import { TeamEvaluationService } from "../../src/Service/TeamEvaluationService";

type Ajax = (params: Record<string, unknown>, ok: (data: unknown) => void, err?: () => void) => void;
const general = (unsafeWindow.shared as unknown as { general: { hh_ajax?: Ajax } }).general;
const teamGearCall = (params: Record<string, unknown>): Promise<unknown> =>
    (TeamGear as unknown as { call: (p: Record<string, unknown>) => Promise<unknown> }).call(params);

describe("timed game calls", () => {
    afterEach(() => {
        delete general.hh_ajax;
        jest.useRealTimers();
    });

    describe("TeamGear.call", () => {
        it("resolves with the answer", async () => {
            general.hh_ajax = (_p, ok) => ok({ success: true, n: 1 });
            await expect(teamGearCall({ action: 'x' })).resolves.toEqual({ success: true, n: 1 });
        });
        it("null on the error callback", async () => {
            general.hh_ajax = (_p, _ok, err) => err && err();
            await expect(teamGearCall({ action: 'x' })).resolves.toBeNull();
        });
        it("null when hh_ajax throws", async () => {
            general.hh_ajax = () => { throw new Error('boom'); };
            await expect(teamGearCall({ action: 'x' })).resolves.toBeNull();
        });
        it("null after 20 s without an answer, not before", async () => {
            jest.useFakeTimers();
            general.hh_ajax = () => { /* never answers */ };
            let result: unknown = 'pending';
            teamGearCall({ action: 'x' }).then((r) => { result = r; });
            await jest.advanceTimersByTimeAsync(19_999);
            expect(result).toBe('pending');
            await jest.advanceTimersByTimeAsync(1);
            expect(result).toBeNull();
        });
        it("null without hh_ajax", async () => {
            await expect(teamGearCall({ action: 'x' })).resolves.toBeNull();
        });
    });

    describe("TeamEvaluationService.measureTeam", () => {
        it("maps the answer", async () => {
            general.hh_ajax = (_p, ok) => ok({ caracs: { ego: '10', damage: 2, defense: 3, chance: 4 }, total_power: '99' });
            await expect(TeamEvaluationService.measureTeam([1, 2], 'leagues'))
                .resolves.toEqual({ caracs: { ego: 10, damage: 2, defense: 3, chance: 4 }, totalPower: 99 });
        });
        it("null on an answer without caracs", async () => {
            general.hh_ajax = (_p, ok) => ok({ success: true });
            await expect(TeamEvaluationService.measureTeam([1], 'leagues')).resolves.toBeNull();
        });
        it("null when hh_ajax throws", async () => {
            general.hh_ajax = () => { throw new Error('boom'); };
            await expect(TeamEvaluationService.measureTeam([1], 'leagues')).resolves.toBeNull();
        });
        it("null after 15 s without an answer, not before", async () => {
            jest.useFakeTimers();
            general.hh_ajax = () => { /* never answers */ };
            let result: unknown = 'pending';
            TeamEvaluationService.measureTeam([1], 'leagues').then((r) => { result = r; });
            await jest.advanceTimersByTimeAsync(14_999);
            expect(result).toBe('pending');
            await jest.advanceTimersByTimeAsync(1);
            expect(result).toBeNull();
        });
        it("sends the team as strings with the battle type", async () => {
            let sent: Record<string, unknown> = {};
            general.hh_ajax = (p, ok) => { sent = p; ok({ caracs: {} }); };
            await TeamEvaluationService.measureTeam([7, 8], 'trolls');
            expect(sent).toEqual({ action: 'team_calculate_caracs', girls: ['7', '8'], battle_type: 'trolls' });
        });
    });
});
