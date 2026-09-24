import { isBossBangRunning, updateData } from '../../src/Service/InfoService';
import { getTextForUI } from '../../src/Helper/LanguageHelper';
import { setTimer } from '../../src/Helper/TimerHelper';
import { HHStoredVarPrefixKey } from '../../src/config/HHStoredVars';
import { SK, TK } from '../../src/config/StorageKeys';
import { MockHelper } from '../testHelpers/MockHelpers';

const setting = (key: string, value: string) => localStorage.setItem(HHStoredVarPrefixKey + key, value);
const bossBang = (isCompleted: boolean, endsInMs: number) => sessionStorage.setItem(HHStoredVarPrefixKey + TK.eventsList, JSON.stringify({
    boss_bang_event_5: { id: 'boss_bang_event_5', type: 'bossBang', isCompleted, seconds_before_end: Date.now() + endsInMs },
}));
const panel = () => { updateData(); return document.getElementById('pInfo')!.textContent || ''; };

describe("InfoService: event rows only while the event runs", function () {
    beforeEach(() => {
        MockHelper.mockDomain("www.hentaiheroes.com");
        localStorage.clear();
        sessionStorage.clear();
        document.body.innerHTML = '<div id="pInfo"></div>';
        setting(SK.showInfo, 'true');
        unsafeWindow.seasonal_event_active = false;
        unsafeWindow.seasonal_time_remaining = 0;
        unsafeWindow.mega_event_active = false;
        unsafeWindow.mega_event_time_remaining = 0;
    });

    describe("isBossBangRunning", function () {
        it("is true for a parsed boss bang that is neither beaten nor over", function () {
            bossBang(false, 3600_000);
            expect(isBossBangRunning()).toBe(true);
        });
        it("is false once the boss is beaten, once the event is over, and without any event", function () {
            bossBang(true, 3600_000);
            expect(isBossBangRunning()).toBe(false);
            bossBang(false, -1000);
            expect(isBossBangRunning()).toBe(false);
            sessionStorage.clear();
            expect(isBossBangRunning()).toBe(false);
        });
    });

    it("shows the boss bang row while the event runs, and hides it once the boss is beaten", function () {
        setting(SK.bossBangEvent, 'true');
        setTimer('nextBossBangTime', 600);
        const label = getTextForUI("pinfoBossBang", "elementText");

        bossBang(false, 3600_000);
        expect(panel()).toContain(label);

        bossBang(true, 3600_000);
        expect(panel()).not.toContain(label);
    });

    it("shows the seasonal row only while the game reports a seasonal event", function () {
        setting(SK.autoSeasonalEventCollectAll, 'true');
        setTimer('nextSeasonalEventCollectAllTime', 3600);
        const label = getTextForUI("pinfoSeasonalEvent", "elementText");

        expect(panel()).not.toContain(label);

        unsafeWindow.mega_event_active = true;
        expect(panel()).toContain(label);
    });

    it("hides the path of valor row once its end has passed, and keeps it while the end is unknown", function () {
        setting(SK.autoPoVCollectAll, 'true');
        setTimer('nextPoVCollectAllTime', 3600);
        const label = getTextForUI("pinfoPoVCollect", "elementText");

        expect(panel()).toContain(label);

        setTimer('PoVRemainingTime', -10);
        expect(panel()).not.toContain(label);

        setTimer('PoVRemainingTime', 3600);
        expect(panel()).toContain(label);
    });
});
