import { getStoredValue } from "../../Helper/StorageHelper";
import { TimeHelper, randomInterval } from "../../Helper/TimeHelper";
import { logHHAuto } from "../../Utils/LogUtils";
import { HHStoredVarPrefixKey } from "../../config/HHStoredVars";

export class HaremFilter {
    STARTING_INDEX = 1;
    COMMON_INDEX = 2;
    RARE_INDEX = 3;
    EPIC_INDEX = 4;
    LEGENDARY_INDEX = 5;
    MYTHIC_INDEX = 6;
    STAR_SEPARATOR = '_';

    RARITY_ORDER = [this.STARTING_INDEX, this.MYTHIC_INDEX, this.LEGENDARY_INDEX, this.EPIC_INDEX, this.RARE_INDEX, this.COMMON_INDEX];
    
    openFilter() {
        $('#filter_girls').trigger('click');
    }

    resetFilter() {
        $('#reset-filters').trigger('click');
    }

    getRarityFilterValues(): any[] {
        if (getStoredValue(HHStoredVarPrefixKey + "Setting_autoSalaryUseFilter") === "true") {
            return getStoredValue(HHStoredVarPrefixKey + "Setting_autoSalaryFilter") ? getStoredValue(HHStoredVarPrefixKey + "Setting_autoSalaryFilter").split(";") : this.RARITY_ORDER;
        }
        return [];
    }

    private async selectOption(selector:string, index:number) {
        $('.select-group.' + selector +' .selectric-wrapper .selectric').trigger('click');
        await TimeHelper.sleep(randomInterval(200, 400)); // wait open
        $('.select-group.' + selector + ' .selectric-items li[data-index="' + index + '"]').trigger('click');
        await TimeHelper.sleep(randomInterval(800, 1200)); // wait loading
    }

    async selectGirlRarity(rarityIndex: number = 1) {
        await this.selectOption('girl-rarity-dropdown', rarityIndex);
    }

    async selectGirlAffectionCategory(stars: number = 0) {
        const starsMapping = {
            0: 0, // All
            1: 1,
            3: 2,
            5: 3,
            6: 4
        };
        if (starsMapping.hasOwnProperty(stars)) {
            await this.selectOption('girl-max-grade-dropdown', starsMapping[stars]);
        } else {
            logHHAuto(`Error unkown GirlAffectionCategory ${stars}, selecting all`);
            await this.selectOption('girl-max-grade-dropdown', 0);
        }
    }

    private getGirlAffectionCategory() {
        return $('.select-group.girl-max-grade-dropdown .selectric-items li.selected').data('index');
    }

    async selectOnlyOwnedGirls() {
        const ownedButton = $('.check-btn.shards-state[shards="100"]');
        if (ownedButton.attr('selected') == null) {
            ownedButton.trigger('click');
        }
        const hasShardButton = $('.check-btn.shards-state[shards="1-99"]');
        if (hasShardButton.attr('selected') != null) {
            hasShardButton.trigger('click');
        }
        const noShardButton = $('.check-btn.shards-state[shards="no_shards"]');
        if (noShardButton.attr('selected') != null) {
            noShardButton.trigger('click');
        }
        await TimeHelper.sleep(randomInterval(800, 1200)); // wait loading
    }

    async selectSkilledGirls(skillLevel: number = 1) {
        $('#skill-tier-select').val(skillLevel).trigger('change'); // Select girl with at least 1 skill
        await TimeHelper.sleep(randomInterval(800, 1200)); // wait loading
    }

    async selectGirlFilters(girlType: string) {
        logHHAuto(`selectGirlRarity ${girlType.charAt(0)}.`);
        await this.selectGirlRarity(Number(girlType.charAt(0)));

        if (girlType.length === 3) {
            logHHAuto(`selectGirlCategory ${girlType.charAt(2)}.`);
            await this.selectGirlAffectionCategory(Number(girlType.charAt(2)));
        } else if (this.getGirlAffectionCategory() != '0') {
            logHHAuto('reset selectGirlCategory');
            await this.selectGirlAffectionCategory(0);
        }
    }


}