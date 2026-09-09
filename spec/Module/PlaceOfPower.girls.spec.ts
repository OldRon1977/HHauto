import { PlaceOfPower } from "../../src/Module/PlaceOfPower";

/**
 * Which girls go into a Place of Power.
 *
 * This is a write with a price: a girl sent into a PoP is locked there for
 * hours. The maths behind that decision had no test -- PlaceOfPower.ts sat at
 * 9.8 % statement coverage -- while the module is one of the write paths
 * ADR-011 keeps a whole game account for.
 *
 * `girlPower` fills a power budget from the end of the list; `chooseGirlsTeam`
 * runs it once per starting point and keeps the best-scoring result, where the
 * score deliberately rewards using *fewer* girls for the same power.
 */
const girl = (id: number, power: number) => ({ id, power });

describe("PlaceOfPower.girlPower -- filling a power budget", () => {
    it("takes a girl that fits", () => {
        expect(PlaceOfPower.girlPower(100, [girl(1, 60)], [])).toEqual([girl(1, 60)]);
    });

    it("leaves a girl that does not fit", () => {
        expect(PlaceOfPower.girlPower(50, [girl(1, 60)], [])).toEqual([]);
    });

    it("keeps going past a girl it could not afford", () => {
        // Works from the end of the list: 30 fits, 200 does not, 40 fits.
        expect(PlaceOfPower.girlPower(100, [girl(1, 40), girl(2, 200), girl(3, 30)], []))
            .toEqual([girl(3, 30), girl(1, 40)]);
    });

    it("stops once the budget is spent", () => {
        const chosen = PlaceOfPower.girlPower(100, [girl(1, 60), girl(2, 70)], []);

        expect(chosen).toEqual([girl(2, 70)]);
    });

    it("adds to a selection it is handed", () => {
        expect(PlaceOfPower.girlPower(100, [girl(2, 50)], [girl(1, 10)]))
            .toEqual([girl(1, 10), girl(2, 50)]);
    });

    it("returns nothing for an empty list", () => {
        expect(PlaceOfPower.girlPower(100, [], [])).toEqual([]);
    });

    it("empties the list it is given", () => {
        // Not a nicety: it pops off the caller's array. chooseGirlsTeam gets
        // away with it by passing a slice; anything else would lose its list.
        const list = [girl(1, 10), girl(2, 20)];

        PlaceOfPower.girlPower(100, list, []);

        expect(list).toEqual([]);
    });
});

describe("PlaceOfPower.chooseGirlsTeam -- which of the options wins", () => {
    afterEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    it("returns nothing when there are no girls", () => {
        expect(PlaceOfPower.chooseGirlsTeam(100, [])).toEqual([]);
    });

    it("prefers one girl who covers the power over two who also do", () => {
        // Both options reach 100. The score divides by sqrt(count), so the
        // shorter team wins -- the comment in the code calls it "more
        // efficient teams (ie: fewer girls)".
        const chosen = PlaceOfPower.chooseGirlsTeam(100, [girl(1, 50), girl(2, 50), girl(3, 100)]);

        expect(chosen).toEqual([girl(3, 100)]);
    });

    it("takes the pair when no single girl covers the power", () => {
        const chosen = PlaceOfPower.chooseGirlsTeam(100, [girl(1, 50), girl(2, 50)]);

        expect(chosen.map(g => g.id).sort()).toEqual([1, 2]);
    });

    it("leaves the caller's list intact", () => {
        // girlPower empties what it is handed; chooseGirlsTeam must not pass
        // the caller's own array into it.
        const list = [girl(1, 50), girl(2, 60)];

        PlaceOfPower.chooseGirlsTeam(100, list);

        expect(list).toEqual([girl(1, 50), girl(2, 60)]);
    });

    it("returns nothing when no girl fits the budget", () => {
        expect(PlaceOfPower.chooseGirlsTeam(10, [girl(1, 50), girl(2, 60)])).toEqual([]);
    });

    it("never sends more power than the budget allows", () => {
        const girls = [girl(1, 30), girl(2, 45), girl(3, 55), girl(4, 70)];

        const chosen = PlaceOfPower.chooseGirlsTeam(100, girls);

        expect(chosen.reduce((sum, g) => sum + g.power, 0)).toBeLessThanOrEqual(100);
    });
});
