import { HHAuto_ToolTips } from '../../src/i18n/empty';
import '../../src/i18n/en';
import '../../src/i18n/de';
import '../../src/i18n/fr';
import '../../src/i18n/es';

/**
 * Keys the code never spells out in one piece: it builds them at runtime by
 * concatenation, so no plain-text search for the key finds a reference.
 *
 * Twice now a "this key is referenced nowhere" sweep has deleted keys from
 * this family -- once the nine restored in 8.10.41, then the labyrinth row
 * selectors and the harem equipment/skills popups, which reached the screen
 * as "en/<key>/elementText not found." until 8.10.46. This list is the
 * counter-evidence: each entry names the call site that builds it.
 */
const BUILT_AT_RUNTIME: ReadonlyArray<readonly [string, string]> = [
    // Labyrinth.ts: hhMenuSelect('autoLabyrinthBuild' + value) for Back/Mid/Front
    ['autoLabyrinthBuildBack', "Labyrinth.moduleBuildTeam, 'autoLabyrinthBuild' + value"],
    ['autoLabyrinthBuildMid', "Labyrinth.moduleBuildTeam, 'autoLabyrinthBuild' + value"],
    ['autoLabyrinthBuildFront', "Labyrinth.moduleBuildTeam, 'autoLabyrinthBuild' + value"],
    // Labyrinth.ts: getTextForUI('autoLabyrinthBuild' + value) for the Team button
    ['autoLabyrinthBuildTeam', "Labyrinth.moduleBuildTeam, 'autoLabyrinthBuild' + value"],
    // HaremGirl.HaremDisplayGirlPopup: getTextForUI('give' + haremItem)
    ['giveexperience', "HaremDisplayGirlPopup, 'give' + haremItem"],
    ['giveaffection', "HaremDisplayGirlPopup, 'give' + haremItem"],
    ['giveequipment', "HaremDisplayGirlPopup, 'give' + haremItem"],
    ['giveskills', "HaremDisplayGirlPopup, 'give' + haremItem"],
    // HaremGirl.HaremDisplayGirlPopup: getTextForUI('cost' + haremItem)
    ['costexperience', "HaremDisplayGirlPopup, 'cost' + haremItem"],
    ['costaffection', "HaremDisplayGirlPopup, 'cost' + haremItem"],
];

describe('i18n keys built by concatenation', () => {
    it.each(BUILT_AT_RUNTIME)('en.ts still has %s (%s)', (key) => {
        expect(HHAuto_ToolTips.en[key]).toBeDefined();
        expect(HHAuto_ToolTips.en[key].elementText).toBeTruthy();
    });

    // A missing localized key falls back to English, so this is not fatal --
    // but the four files are kept in step, and a gap here means one language
    // lost a text the others still have.
    it.each(['de', 'fr', 'es'])('%s has them too', (lang) => {
        const missing = BUILT_AT_RUNTIME
            .map(([key]) => key)
            .filter((key) => !HHAuto_ToolTips[lang as 'de' | 'fr' | 'es'][key]);
        expect(missing).toEqual([]);
    });
});
