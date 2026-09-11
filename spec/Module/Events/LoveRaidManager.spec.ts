import { LoveRaidManager } from "../../../src/Module/Events/LoveRaidManager";

// Measured 2026-09-11: /map.html declares `var love_raids = [...]` (a window
// property); /love-raids.html declares `const love_raids = [...]` in an inline
// script, and window.love_raids there is the empty module object of the
// game's love_raids.js.
describe("LoveRaidManager.readPageRaids", function () {
    const win = unsafeWindow as unknown as Record<string, unknown>;

    function inlineScript(text: string) {
        const script = document.createElement('script');
        script.type = 'text/x-not-run'; // jsdom would run it otherwise
        script.textContent = text;
        document.body.appendChild(script);
    }

    afterEach(() => {
        document.body.innerHTML = '';
        delete win.love_raids;
    });

    it("takes the list from the window where the page declares a var", function () {
        win.love_raids = [{ id_raid: 1, status: 'ongoing' }];
        expect(LoveRaidManager.readPageRaids()).toEqual([{ id_raid: 1, status: 'ongoing' }]);
    });

    it("reads the inline const on the raid page, where window.love_raids is an empty object", function () {
        win.love_raids = {};
        inlineScript('\n\tvar a = [9];\n\tconst love_raids = [{"id_raid":4274,"status":"ongoing",'
            + '"event_name":"x ] \\" [","girl_data":{"shards":0}},{"id_raid":4275,"status":"upcoming"}];\n\tvar b = [1];');
        expect(LoveRaidManager.readPageRaids()).toEqual([
            { id_raid: 4274, status: 'ongoing', event_name: 'x ] " [', girl_data: { shards: 0 } },
            { id_raid: 4275, status: 'upcoming' },
        ]);
    });

    it("returns no raids when the page has none in either form", function () {
        win.love_raids = {};
        inlineScript('var something_else = [1,2];');
        expect(LoveRaidManager.readPageRaids()).toEqual([]);
    });

    it("returns no raids when the literal is cut off", function () {
        inlineScript('const love_raids = [{"id_raid":1,');
        expect(LoveRaidManager.readPageRaids()).toEqual([]);
    });
});
