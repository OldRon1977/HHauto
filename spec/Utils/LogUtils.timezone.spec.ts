import { describeTimeZone } from "../../src/Utils/LogUtils";

describe("describeTimeZone", () => {
    it("names the offset from UTC with sign, hours and minutes", () => {
        const d = new Date(1_700_000_000_000);
        const off = -d.getTimezoneOffset();
        const expected = `UTC${off >= 0 ? "+" : "-"}${String(Math.floor(Math.abs(off) / 60)).padStart(2, "0")}:${String(Math.abs(off) % 60).padStart(2, "0")}`;
        expect(describeTimeZone(d)).toContain(expected);
    });
});
