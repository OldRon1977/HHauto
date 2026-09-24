import { getAndStoreCollectPreferences, getStoredArray } from '../../src/Helper/StorageHelper';
import { HHStoredVarPrefixKey } from '../../src/config/HHStoredVars';
import { SK } from '../../src/config/StorageKeys';

const POV = HHStoredVarPrefixKey + SK.autoPoVCollectablesList;
const SEASON = HHStoredVarPrefixKey + SK.autoSeasonCollectablesList;
const DAILY = HHStoredVarPrefixKey + SK.autoDailyGoalsCollectablesList;
const SULTRY = HHStoredVarPrefixKey + SK.sultryMysteriesAutoOpenCollectablesList;

const popup = () => document.querySelector('#HHAutoPopupGlobalPopup.menuCollectable')!;
const box = (id: string) => popup().querySelector<HTMLInputElement>('input#' + id)!;
const click = (id: string) => document.getElementById(id)!.click();

describe("collect preferences popup", function() {
    beforeEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
        sessionStorage.clear();
    });

    it("shows checkboxes, no switches, and a clicked label stores its type", function() {
        getAndStoreCollectPreferences(POV);
        expect(popup().querySelectorAll('.switch')).toHaveLength(0);
        popup().querySelector<HTMLElement>('label.HHCollectablesItem span')!.click();
        expect(getStoredArray<string>(POV)).toEqual(['energy_kiss']);
    });

    it("\"All but XP\" ticks every box except XP", function() {
        getAndStoreCollectPreferences(POV);
        click('collectAllButXp');
        const stored = getStoredArray<string>(POV);
        expect(stored).not.toContain('xp');
        expect(stored).toContain('girl_shards');
        expect(stored).toHaveLength(popup().querySelectorAll('.menuCollectablesItem').length - 1);
    });

    it("\"Toggle All\" still inverts every box", function() {
        getAndStoreCollectPreferences(POV);
        box('gems').click();
        click('toggleCollectables');
        const stored = getStoredArray<string>(POV);
        expect(stored).not.toContain('gems');
        expect(stored).toContain('xp');
    });

    it("\"Copy to all\" copies the selection to the other generic lists, not to Sultry Mysteries", function() {
        localStorage.setItem(SULTRY, JSON.stringify(['item']));
        getAndStoreCollectPreferences(POV);
        box('gems').click();
        box('orbs').click();
        click('collectApplyToAll');
        expect(getStoredArray<string>(SEASON)).toEqual(['orbs', 'gems']);
        expect(getStoredArray<string>(DAILY)).toEqual(['orbs', 'gems']);
        expect(getStoredArray<string>(SULTRY)).toEqual(['item']);
        expect(document.getElementById('collectApplyToAllDone')!.textContent).toContain('9');
    });

    it("the Sultry Mysteries popup has neither of the two new buttons", function() {
        getAndStoreCollectPreferences(SULTRY, 'text', 'sultryMysteriesRewardsList');
        expect(document.getElementById('collectAllButXp')).toBeNull();
        expect(document.getElementById('collectApplyToAll')).toBeNull();
        expect(document.getElementById('toggleCollectables')).not.toBeNull();
    });
});
