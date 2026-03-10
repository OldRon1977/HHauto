// RelicManager.ts -- Manages labyrinth relics: detects available relics and
// selects the best options.
//
// After completing labyrinth rooms, the player is offered a choice of relics
// that provide bonuses for the current run. This module evaluates available
// relic options and selects the optimal one based on configured preferences.
//
// Used by: LabyrinthAuto.ts (called after room completion)
//
import { HHStoredVarPrefixKey, TK } from "../config/index";
import {
    ConfigHelper,
    getStoredValue,
    randomInterval,
    RewardHelper,
    TimeHelper
} from "../Helper/index";
import {
    logHHAuto
} from "../Utils/LogUtils";
import { safeJsonParse } from "../Utils/index";


export class LabyrinthRelic {
    index = 0;
    type = 0;
    isGirl = false;
    slot = $();
    benefit = 0;
    element = '';
    girlName = '';

    constructor(index: number, slot: JQuery<HTMLElement>) {
        this.index = index;
        this.slot = slot;
        if (slot.hasClass('common-relic')) this.type = 1;
        if (slot.hasClass('rare-relic')) this.type = 2;
        if (slot.hasClass('epic-relic')) this.type = 3;
        if (slot.hasClass('legendary-relic')) this.type = 4;
        if (slot.hasClass('mythic-relic')) this.type = 5;

        if (slot.hasClass('large-card')) {
            this.isGirl = true;
            try {
                const tooltipData = $('.girl-image', slot).attr(<string>ConfigHelper.getHHScriptVars('girlToolTipData')) || '';
                if (tooltipData != '') {
                    this.girlName = safeJsonParse(tooltipData, {name: ''}).name;
                }
            } catch (err) { 
                // logHHAuto('ERROR: Can\'t find girl name');
            }
        }

        try {
            this.benefit = Number((slot.find('.relic-description').text().match(/\d+.\d/) || slot.find('.relic-description').text().match(/\d+/))[0]);
        } catch (err) {
            // logHHAuto('ERROR: Can\'t find reward value');
        }
        try {
            const classes = slot.find('.team-relic-icon').children().first().attr('class');
            this.element = classes.substring(0, classes.indexOf('_element_relic_icn'));
        } catch (err) {
            // logHHAuto('ERROR: Can\'t find reward element');
        }
    }
}

export class RelicManager {
    debugEnabled:boolean;

    constructor() {
        this.debugEnabled = getStoredValue(HHStoredVarPrefixKey + TK.Debug) === 'true';
    }

    parseRelics(): LabyrinthRelic[] {
        const relics: LabyrinthRelic[] = [];

        $.each($('#labyrinth_reward_popup #reward_holder .relic-container'), (rewIndex, $reward) => {
            const relic = new LabyrinthRelic(rewIndex, $($reward));
            relics.push(relic);
        });

        return relics
    }

    chooseRelic(relics: LabyrinthRelic[]): LabyrinthRelic {
        let chosenRelic:LabyrinthRelic;
        for (let i = 0; i < relics.length; i++) {
            const relic = relics[i];
            if (!chosenRelic && !relic.isGirl && relic.element === '') chosenRelic = relic;
            else if (chosenRelic?.type < relic.type && !relic.isGirl && relic.element === '') chosenRelic = relic;
        }
        if(!chosenRelic) {
            for (let i = 0; i < relics.length; i++) {
                const relic = relics[i];
                if (!chosenRelic && relic.element != '') chosenRelic = relic;
                else if (chosenRelic?.type < relic.type && relic.element != '') chosenRelic = relic;
            }
        }
        if(!chosenRelic) {
            for (let i = 0; i < relics.length; i++) {
                const relic = relics[i];
                if (!chosenRelic) chosenRelic = relic;
                else if (chosenRelic?.type < relic.type) chosenRelic = relic;
            }
        }
        return chosenRelic
    }

    async selectRelic() {
        try{
            const relics = this.parseRelics();
            if (this.debugEnabled) logHHAuto('relics', relics);
            const relic = this.chooseRelic(relics);
            if (this.debugEnabled) logHHAuto('Selecting', relic);

            $($('#labyrinth_reward_popup #reward_holder .relic-card-buttons .claim-relic-btn').get(relic.index)).trigger('click');
        } catch (err) {
            logHHAuto('Error selecting relics, select first no girl relic');
            $('#labyrinth_reward_popup #reward_holder .relic-container:not(.large-card) .relic-card-buttons .claim-relic-btn').first().trigger('click');
        }
        await TimeHelper.sleep(randomInterval(800, 1300));

        // Close reward popup or wait until it opens
        for(var i=0; i<3;i++) {
            const popupOpened = RewardHelper.closeRewardPopupIfAny(this.debugEnabled, 'labyrinth_reward_popup');
            await TimeHelper.sleep(randomInterval(800, 1300));
            if (popupOpened) break;
        }
    }

    /*static testRelicParser(){
        try {
            const observer = new MutationObserver(() => {
                if ($('.relics-grid').length > 0) {
                    const rewards: LabyrinthRelic[] = [];
                    $.each($('#relics_tab_container .relic-container'), (rewIndex, $reward) => {
                        const labyReward = new LabyrinthRelic(rewIndex, $($reward));
                        rewards.push(labyReward);
                    });
                    logHHAuto('Laby relic', rewards);
                }
            })
            observer.observe($('#relics_tab_container .relics-container')[0], { childList: true, attributes: false });

        } catch (err) {

        }
    }*/
}