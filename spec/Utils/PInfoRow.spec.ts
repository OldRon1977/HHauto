// Unit tests for the pInfo row markup.
//
// The row is what makes the value column line up, so the structural promises
// are worth pinning: two spans in a fixed order, a full-width row when there is
// no value, and attributes that survive on the <li> rather than moving into a
// span (the red colouring and the failure tooltip depend on that).
import { pInfoRow } from "../../src/Utils/PInfoRow";

const parse = (html: string): HTMLElement => {
    const ul = document.createElement("ul");
    ul.innerHTML = html;
    expect(ul.children).toHaveLength(1);
    return ul.firstElementChild as HTMLElement;
};

describe("pInfoRow", () => {
    it("puts the label left and the value right", () => {
        const li = parse(pInfoRow("Season 34/40", "1h 2m"));
        expect(li.tagName).toBe("LI");
        const spans = Array.from(li.children) as HTMLElement[];
        expect(spans.map((s) => s.className)).toEqual(["pInfoLabel", "pInfoValue"]);
        expect(spans[0].textContent).toBe("Season 34/40");
        expect(spans[1].textContent).toBe("1h 2m");
    });

    it("renders a label-only row when there is no value", () => {
        const li = parse(pInfoRow("Troll 12/20"));
        expect(li.querySelector(".pInfoValue")).toBeNull();
        expect(li.querySelector(".pInfoLabel")!.textContent).toBe("Troll 12/20");
    });

    it("keeps style and title on the row itself", () => {
        const li = parse(pInfoRow("League", "5m", { style: "color:red!important;", title: "Booster missing" }));
        expect(li.getAttribute("style")).toContain("color:red");
        expect(li.getAttribute("title")).toBe("Booster missing");
        expect(li.querySelector(".pInfoLabel")!.getAttribute("style")).toBeNull();
    });

    it("escapes quotes in the title instead of breaking out of the attribute", () => {
        const li = parse(pInfoRow("Block", "", { title: 'failed: "bad" <thing> & more' }));
        expect(li.getAttribute("title")).toBe('failed: "bad" <thing> & more');
        expect(li.children).toHaveLength(1);
    });

    it("omits empty attributes", () => {
        const html = pInfoRow("Salary", "3m", { style: "", title: "" });
        expect(html.startsWith("<li>")).toBe(true);
    });

    it("passes markup in the label through, for the reactivate affordance", () => {
        const li = parse(pInfoRow('&lt;ERROR&gt; Season <span data-reactivate-block="handleSeason">[reactivate]</span>', ""));
        expect(li.querySelector("[data-reactivate-block]")).not.toBeNull();
        expect(li.textContent).toContain("<ERROR> Season");
    });
});
