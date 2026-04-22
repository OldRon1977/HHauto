// HaremGirl.ts -- Individual girl data: stats, upgrade costs, and affection/XP
// management.
//
// Each girl in the harem has stats, levels, affection, and XP. This module
// handles reading and managing individual girl data, calculating upgrade
// costs, tracking affection and XP progress, and performing upgrades when
// configured to do so.
//
// Used by: Harem.ts (girl list operations), EventModule.ts (girl shard tracking)
//
import {
    deleteStoredValue,
    ConfigHelper,
    getHHVars,
    getStoredValue,
    getTextForUI,
    parsePrice,
    randomInterval,
    setStoredValue,
    HeroHelper,
    TimeHelper,
    NumberHelper,
    getStoredJSON
} from "../../Helper/index";
import { Harem } from "../index";
import { gotoPage } from "../../Service/index";
import { displayHHPopUp, fillHHPopUp, logHHAuto, maskHHPopUp } from "../../Utils/index";
import { HHAuto_inputPattern, HHStoredVarPrefixKey, SK, TK } from "../../config/index";
import { KKHaremGirl, TeamData } from "../../model/index";


export class HaremGirl {
    static AFFECTION_TYPE='affection';
    static EXPERIENCE_TYPE='experience';
    static EQUIPMENT_TYPE ='equipment';
    static SKILLS_TYPE ='skills';
    static SCROLLS_NEED_5 = {
        'mythic_6': 31,
        'legendary_5': 27,
        'legendary_3': 19,
        'epic_5': 25,
        'epic_3': 18,
        'rare_5': 21,
        'rare_3': 16,
        'common_5': 19,
        'common_3': 15,
        'common_1': 9
    }
    static SCROLLS_NEED_4 = {
        'mythic_6': 26,
        'legendary_5': 23,
        'legendary_3': 19,
        'epic_5': 22,
        'epic_3': 18,
        'rare_5': 19,
        'rare_3': 16,
        'common_5': 18,
        'common_3': 15,
        'common_1': 9
    }

    static SKILL_BUTTON_SELECTOR = "#skills .skill-upgrade button.blue_button_L:not([disabled])";
    static SKILL_ORDER_PRIO = [2,5,4,8];

    static getCurrentGirl(): KKHaremGirl {
        return unsafeWindow.girl;
    }

    static getMaxOutButton(haremItem:string){
        return $('#girl-leveler-max-out-'+haremItem+':not([disabled])');
    }

    static getMaxOutAllButton(haremItem: string){
        return $('#girl-leveler-max-out-all-levels-'+haremItem+':not([disabled])');
    }

    static switchTabs(haremItem: string){
        $('#girl-leveler-tabs .switch-tab[data-tab="' + haremItem + '"]').trigger('click');
    }

    static confirmMaxOut(){
        const confirmMaxOutButton = $('#girl_max_out_popup button.blue_button_L:not([disabled]):visible[confirm_callback]');
        if(confirmMaxOutButton.length > 0) {
            confirmMaxOutButton.trigger('click');
        } else logHHAuto('Confirm max out button not found');
    }

    static maxOutButtonAndConfirm(haremItem:string, girl: KKHaremGirl) {
        return new Promise((resolve) => {
            const maxOutButton = HaremGirl.getMaxOutButton(haremItem);
            if(maxOutButton.length > 0) {
                logHHAuto('Max out ' + haremItem + ' for girl ' + girl.id_girl);
                maxOutButton.trigger('click');
                setTimeout(() => {
                    HaremGirl.confirmMaxOut();
                    setTimeout(() => {
                        resolve(true); 
                    }, 200);
                }, randomInterval(700,1100));
            } else {
                logHHAuto('Max out button for' + haremItem + ' for girl ' + girl.id_girl + ' not enabled');
                resolve(false);
            }
        });
    }

    static confirmMaxOutAllCash() {
        const confirmMaxOutButton = $('#girl_max_out_all_levels_popup button.green_button_L:not([disabled]):visible[confirm_callback][currency="soft_currency"]');
        if (confirmMaxOutButton.length > 0) {
            confirmMaxOutButton.trigger('click');
        } else logHHAuto('Confirm max out all button not found');
    }

    static getMaxOutPrice(): number {
        return Number($('#girl_max_out_all_levels_popup .slot_soft_currency .amount').text().replace(/\D+/g, ""));
    }

    static confirmMaxOutAllGems() {
        const confirmMaxOutButton = $('#girl_max_out_all_levels_popup button.blue_button_L:not([disabled]):visible[confirm_callback]');
        if (confirmMaxOutButton.length > 0) {
            confirmMaxOutButton.trigger('click');
        } else logHHAuto('Confirm max out all button not found');
    }

    static getMaxOutGems(): number {
        return Number($('#girl_max_out_all_levels_popup .slot_gems .amount').text().replace(/\D+/g, ""));
    }

    static maxOutAllButtonAndConfirm(haremItem:string, girl: KKHaremGirl): Promise<any> {
        return new Promise((resolve) => {
            const maxOutButton = HaremGirl.getMaxOutAllButton(haremItem);
            if(maxOutButton.length > 0) {
                //logHHAuto('Max out all ' + haremItem + ' for girl ' + girl.id_girl);
                maxOutButton.trigger('click');
                if (haremItem == HaremGirl.EXPERIENCE_TYPE) {
                    setTimeout( async () => {
                        const cost = HaremGirl.getMaxOutGems();
                        logHHAuto(`Max out all ${haremItem} (for ${cost} gems) for girl ${girl.name} (${girl.id_girl})`);
                        HaremGirl.confirmMaxOutAllGems();
                        await TimeHelper.sleep(randomInterval(400, 700));
                        HaremGirl.confirmMaxOut(); // No gems
                        await TimeHelper.sleep(randomInterval(400, 700));
                        resolve(cost);
                    }, randomInterval(700, 1100));

                } else if (haremItem == HaremGirl.AFFECTION_TYPE) {
                    setTimeout(async () => {
                        const cost = HaremGirl.getMaxOutPrice();
                        logHHAuto(`Max out all ${haremItem} (for ${cost}) for girl ${girl.name} (${girl.id_girl})`);
                        HaremGirl.confirmMaxOutAllCash();
                        await TimeHelper.sleep(randomInterval(400, 700));
                        resolve(cost);
                    }, randomInterval(700,1100));
                }
            } else {
                logHHAuto(`Max out all button for ${haremItem} for girl ${girl.name} (${girl.id_girl}) not enabled`);
                resolve(0);
            }
        });
    }

    static confirmAwake(){
        const confAwakButton = $('#awakening_popup button.awaken-btn:not([disabled]):visible');
        if(confAwakButton.length > 0) {
            confAwakButton.trigger('click'); // Page will be refreshed
            return true;
        } else {
            logHHAuto('Confirmation awake button is not enabled');
            Harem.clearHaremToolVariables();
            // TODO Do not clear in list mode
            return false;
        }
    }
    
    static awakGirl(girl: KKHaremGirl) {
        const numberOfGem = unsafeWindow.player_gems_amount[girl.element].amount;
        const canXpGirl = numberOfGem >= girl.awakening_costs;
        const awakButton = $('#awaken:not([disabled])');
        if(awakButton.length > 0 && canXpGirl) {
            logHHAuto('Awake for girl ' + girl.id_girl);
            awakButton.trigger('click');
            setTimeout(HaremGirl.confirmAwake, randomInterval(500,1000)); // Page will be refreshed if done
            return true;
        } else {
            logHHAuto('Awake button for girl ' + girl.id_girl + ' not enabled or not enough gems (' + numberOfGem +'<'+ girl.awakening_costs + ')');
            return false;
        }
    };
    
    static goToGirlQuest(girl: KKHaremGirl, retry=0) {
        const canGiftGirl = girl.nb_grades > girl.graded;
        const upgradeQuest = $('.upgrade_girl').attr('href');
        if(canGiftGirl && upgradeQuest && upgradeQuest.indexOf('/quest/')>=0) {
            logHHAuto('Upgrade for girl ' + girl.id_girl + ' quest:' + upgradeQuest);
            gotoPage(upgradeQuest);
            return true;
        } else {
            logHHAuto('Can\'t upgrade girl ' + girl.id_girl + ': grade (' + girl.graded +'/'+ girl.nb_grades + '), quest :' + upgradeQuest);
            if(!upgradeQuest && retry<2) {
                logHHAuto('Can be loading time, retry in 1s');
                setTimeout(() => {
                    HaremGirl.goToGirlQuest(girl, 1);
                }, randomInterval(1000,1500));
            }
            return false;
        }
    };

    static payGirlQuest(): boolean {
        var proceedButtonMatch = $("#controls button.grade-complete-button:not([style*='display:none']):not([style*='display: none'])");
        if (proceedButtonMatch.length > 0) {
            var proceedButtonCost = $(".price", proceedButtonMatch);
            var proceedCost = parsePrice(proceedButtonCost[0].innerText);
            var moneyCurrent = HeroHelper.getMoney();
            setStoredValue(HHStoredVarPrefixKey+TK.lastActionPerformed, Harem.HAREM_UPGRADE_LAST_ACTION);
            
            console.log("Debug girl Quest MONEY for : "+proceedCost);
            if(proceedCost <= moneyCurrent)
            {
                // We have money.
                logHHAuto("Spending "+proceedCost+" Money to proceed.");
                setTimeout(function () {
                    proceedButtonMatch.trigger('click');
                },randomInterval(500,800));
                return true;
            }
            else
            {
                logHHAuto("Need "+proceedCost+" Money to proceed.");
                Harem.clearHaremToolVariables();
                return false;
            }
        } else {
            const haremGirlPayLast = getStoredValue(HHStoredVarPrefixKey + TK.haremGirlPayLast) == 'true';
            if (haremGirlPayLast) {
                // back
                gotoPage('/girl/' + unsafeWindow.id_girl, { resource: 'affection' }, randomInterval(1500, 2500));
                return true;
            } else {
                logHHAuto("ERROR No pay button found stopping.");
                Harem.clearHaremToolVariables();
                return false;
            }
        }
    }

    static async maxOutAndAwake(haremItem:string, selectedGirl: KKHaremGirl){
        await HaremGirl.maxOutButtonAndConfirm(haremItem, selectedGirl);
        setTimeout(function() {
            HaremGirl.awakGirl(selectedGirl);
        }, randomInterval(1500,2500));
    }
    
    static async giveHaremGirlItem(haremItem:string){
        const selectedGirl = HaremGirl.getCurrentGirl();
        HaremGirl.switchTabs(haremItem);
        const userHaremGirlLimit = Math.min(Number((<HTMLInputElement>document.getElementById("menuExpLevel")).value), 750);

        if((Number(selectedGirl.level) + 50) <= Number(userHaremGirlLimit)) {
            HaremGirl.HaremDisplayGirlPopup(haremItem, selectedGirl.name + ' ' + selectedGirl.Xp.cur + "xp, level " + selectedGirl.level + "/" + userHaremGirlLimit, (1) * 5);

            setStoredValue(HHStoredVarPrefixKey+TK.haremGirlActions, haremItem);
            setStoredValue(HHStoredVarPrefixKey+TK.haremGirlMode, 'girl');
            setStoredValue(HHStoredVarPrefixKey+TK.haremGirlLimit, userHaremGirlLimit);
            setStoredValue(HHStoredVarPrefixKey+TK.lastActionPerformed, Harem.HAREM_UPGRADE_LAST_ACTION);

            if((Number(selectedGirl.level) + 50) >= Number(userHaremGirlLimit)) {
                await HaremGirl.maxOutButtonAndConfirm(haremItem, selectedGirl);
                HaremGirl.HaremClearGirlPopup();
            }
            else {
                setTimeout(function() {
                    HaremGirl.maxOutAndAwake(haremItem, selectedGirl);
                }, randomInterval(500,1000));
            }
        } else{
            if(Number(selectedGirl.level) >= Number(userHaremGirlLimit))
                logHHAuto("Girl already above target, ignoring action");
            else
                logHHAuto("Girl and max out will be above target, ignoring action");
        }
    }

    static async fillAllAffection() {
        const haremItem = HaremGirl.AFFECTION_TYPE;
        const selectedGirl: KKHaremGirl = HaremGirl.getCurrentGirl();
        HaremGirl.switchTabs(haremItem);
        const haremGirlPayLast = getStoredValue(HHStoredVarPrefixKey+TK.haremGirlPayLast) == 'true';
        const canGiftGirl = selectedGirl.nb_grades > selectedGirl.graded;
        const lastGirlGrad = selectedGirl.nb_grades <= (selectedGirl.graded+1);
        const maxOutButton = HaremGirl.getMaxOutButton(haremItem);
        const maxOutAllButton = HaremGirl.getMaxOutAllButton(haremItem);

        if(canGiftGirl) {

            if (haremGirlPayLast && maxOutAllButton.length > 0) {
                await HaremGirl.maxOutAllButtonAndConfirm(haremItem, selectedGirl);
                // reach girl quest
                return true;
            } else if(maxOutButton.length > 0) {
                await HaremGirl.maxOutButtonAndConfirm(haremItem, selectedGirl);

                if (!lastGirlGrad || haremGirlPayLast) {
                    setTimeout(function () {
                        HaremGirl.goToGirlQuest(selectedGirl);
                    }, randomInterval(1500, 2000));
                    return true;
                } else {
                    logHHAuto("Girl grade reach, keep last to buy manually");
                }
            } else if ($('.upgrade_girl').length > 0) {
                // Grade full but quest not paid

                if (!lastGirlGrad || haremGirlPayLast) {
                    setTimeout(function () {
                        HaremGirl.goToGirlQuest(selectedGirl);
                    }, randomInterval(1500, 2000));
                    return true;
                } else {
                    logHHAuto("Girl grade reach, keep last to buy manually");
                }
            }
        } else{
            logHHAuto("Girl grade is already maxed out");
        }
        return false;
    }

    static async fillAllExperience() {
        const haremItem = HaremGirl.EXPERIENCE_TYPE;
        const selectedGirl: KKHaremGirl = HaremGirl.getCurrentGirl();
        HaremGirl.switchTabs(haremItem);
        const maxOutAllButton = HaremGirl.getMaxOutAllButton(haremItem);

        if (maxOutAllButton.length > 0) {
            await HaremGirl.maxOutAllButtonAndConfirm(haremItem, selectedGirl);
            return true;
        } else{
            logHHAuto("Girl level is already maxed out");
        }
        return false;
    }
    
    static addGirlMenu(){
        const girlMenuButtonId = 'girlMenu';
        if($('#'+girlMenuButtonId).length > 0) return;

        var createMenuButton = function(menuId, disabled=false){
            return '<div class="tooltipHH">'
            +    '<span class="tooltipHHtext">'+getTextForUI(menuId,"tooltip")+'</span>'
            +    '<label style="font-size: initial;" class="myButton" '+(disabled?'disabled="disabled"':'')+' id="'+menuId+'Button">'+getTextForUI(menuId,"elementText")
            +'</label></div>';
        }
        
        const girlMenuButton = '<div style="position: absolute;left: 425px;top: 0px; font-size: small; z-index:30;" class="tooltipHH"><span class="tooltipHHtext">'+getTextForUI("girlMenu","tooltip")+'</span><label class="myButton" id="'+girlMenuButtonId+'">+</label></div>';
        var openGirlMenu = function(){
            const selectedGirl = HaremGirl.getCurrentGirl();
            const canGiftGirl = selectedGirl.nb_grades > selectedGirl.graded;// && HaremGirl.getMaxOutButton(HaremGirl.AFFECTION_TYPE).length > 0;

            const menuIDXp = "haremGirlGiveXP";
            const menuIDGifts = "haremGirlGiveGifts";
            const menuIDMaxGifts = "haremGirlGiveMaxGifts";
            const menuIDUpgradeMax = "haremGirlUpgradeMax";
            const menuIDMaxSkill = "haremGirlMaxSkill";

            const menuIDXpButton = createMenuButton(menuIDXp);
            const menuIDGiftsButton = createMenuButton(menuIDGifts);
            const menuIDMaxGiftsButton = createMenuButton(menuIDMaxGifts, !canGiftGirl);
            const menuIDUpgradeMaxButton = createMenuButton(menuIDUpgradeMax, !canGiftGirl);
            const imgPath = ConfigHelper.getHHScriptVars("baseImgPath");
            const menuIDSkillButton = createMenuButton(menuIDMaxSkill);

            
            const girlMenu = '<div style="padding:50px; display:flex;flex-direction:column">'
            //+    '<p id="HaremGirlMenuText">'+getTextForUI("girlMenu","elementText")+'</p>'
            +    '<div class="optionsBoxWithTitle">'
            +       '<div class="optionsBoxTitle"><img class="iconImg" src="'+imgPath+'/design/ic_books_gray.svg"><span class="optionsBoxTitle">'+getTextForUI("experience","elementText")+'</span></div>'
            +       '<div class="optionsBox">'
            +         '<div style="padding:10px">'+menuIDXpButton+'</div>'
            +       '</div>'
            +    '</div>'
            +    '<div class="optionsBoxWithTitle">'
            +       '<div class="optionsBoxTitle"><img class="iconImg" src="'+imgPath+'/design/ic_gifts_gray.svg"><span class="optionsBoxTitle">'+getTextForUI("affection","elementText")+'</span></div>'
            +       '<div class="optionsBox">'
            //+       '<div style="padding:10px">'+menuIDGiftsButton+'</div>'
            +         '<div style="padding:10px">'+menuIDMaxGiftsButton+'</div>'
            +         '<div style="padding:10px">'+menuIDUpgradeMaxButton+'</div>'
            +       '</div>'
            +    '</div>'
            +    '<div class="optionsBoxWithTitle">'
            +       '<div class="optionsBoxTitle"><span class="optionsBoxTitle">' + getTextForUI("skills", "elementText") + '</span></div>'
            +       '<div class="optionsBox">'
            +         '<div style="padding:10px">' + menuIDSkillButton + '</div>'
            +       '</div>'
            +    '</div>'
            fillHHPopUp("GirlMenu",getTextForUI("girlMenu","elementText"), girlMenu);
            $('#'+menuIDXp+'Button').on("click", function()
            {
                maskHHPopUp();
                HaremGirl.switchTabs(HaremGirl.EXPERIENCE_TYPE);
                HaremGirl.displayExpMenu(HaremGirl.EXPERIENCE_TYPE);
            });

            if(canGiftGirl) {
                const fillGirlGifts = (payLast = false) => {
                    maskHHPopUp();
                    HaremGirl.switchTabs(HaremGirl.AFFECTION_TYPE);
                    setStoredValue(HHStoredVarPrefixKey+TK.haremGirlActions, HaremGirl.AFFECTION_TYPE);
                    setStoredValue(HHStoredVarPrefixKey+TK.haremGirlMode, 'girl');
                    setStoredValue(HHStoredVarPrefixKey+TK.haremGirlEnd, 'true');
                    setStoredValue(HHStoredVarPrefixKey+TK.lastActionPerformed, Harem.HAREM_UPGRADE_LAST_ACTION);
                    if (payLast) setStoredValue(HHStoredVarPrefixKey+TK.haremGirlPayLast, 'true');
                    setTimeout(HaremGirl.fillAllAffection, randomInterval(500,800));
                }
                $('#'+menuIDMaxGifts+'Button').on("click",  () => {
                    fillGirlGifts(false);
                });
                $('#'+menuIDUpgradeMax+'Button').on("click", () => {
                    fillGirlGifts(true);
                });
            }

            $('#' + menuIDMaxSkill + 'Button').on("click", async () => {
                maskHHPopUp();
                HaremGirl.switchTabs(HaremGirl.SKILLS_TYPE);
                await TimeHelper.sleep(randomInterval(400, 700));
                HaremGirl.fullSkillsUpgrade();
            });
        };
        $('#girl-leveler-tabs').append(girlMenuButton);

        GM_registerMenuCommand(getTextForUI('girlMenu',"elementText"), openGirlMenu);
        $('#'+girlMenuButtonId).on("click", openGirlMenu);
    }
   


    static displayExpMenu(haremItem = HaremGirl.EXPERIENCE_TYPE){
        const selectedGirl = HaremGirl.getCurrentGirl();

        const menuID = "menuExp";
//        const menuExp = '<div style="position: absolute;right: 50px;top: -10px; font-size: small;" class="tooltipHH"><span class="tooltipHHtext">'+getTextForUI("menuExp","tooltip")+'</span><label style="width:100px" class="myButton" id="menuExp">'+getTextForUI("menuExp","elementText")+'</label></div>'
        const menuExpContent = '<div style="width:600px;justify-content: space-between;align-items: flex-start;"class="HHMenuRow">'
        +   '<div id="menuExp-moveLeft"></div>'
        +   '<div style="padding:10px; display:flex;flex-direction:column;">'
        +    '<p style="min-height:10vh;" id="menuExpText"></p>'
        +    '<div class="HHMenuRow">'
        +     '<p>'+getTextForUI("menuExpLevel","elementText")+'</p>'
        +     '<div style="padding:10px;" class="tooltipHH"><span class="tooltipHHtext">'+getTextForUI("menuExpLevel","tooltip")+'</span><input id="menuExpLevel" style="width:50px;height:20px" required pattern="'+HHAuto_inputPattern.menuExpLevel+'" type="text" value="'+HeroHelper.getLevel()+'"></div>'
        +    '</div>'
        +    '<input id="menuExpMode" type="hidden" value="">'
        +    '<div style="padding:10px;justify-content:center" class="HHMenuRow">'
        +     '<div id="menuExpHide">'
        +      '<div class="tooltipHH"><span class="tooltipHHtext">'+getTextForUI("menuExpButton","tooltip")+'</span><label style="width:80px" class="myButton" id="menuExpButton">'+getTextForUI("menuExpButton","elementText")+'</label></div>'
        +     '</div>'
        +    '</div>'
        +   '</div>'
        +   '<div id="menuExp-moveRight"></div>'
        +  '</div>';

        fillHHPopUp(menuID,getTextForUI("menuExp","elementText"),menuExpContent);
        displayHHPopUp();
        $("#menuExpText").html(selectedGirl.name+" "+selectedGirl.Xp.cur+"xp, level "+selectedGirl.level+"<br>"+getTextForUI("menuExpInfo","elementText")+"<br>");
        (<HTMLInputElement>document.getElementById("menuExpMode")).value = haremItem;

        var KeyUpExp = function(evt)
        {
            if (evt.key === 'Enter')
            {
                maskHHPopUp();
                HaremGirl.giveHaremGirlItem((<HTMLInputElement>document.getElementById("menuExpMode")).value);
            }
        }

        document.removeEventListener('keyup', KeyUpExp, false);
        document.addEventListener('keyup', KeyUpExp, false);

        $("#menuExpButton").on("click", function()
        {
            maskHHPopUp();
            HaremGirl.giveHaremGirlItem(haremItem);
        });
    }

    static canGiftGirl(): boolean {
        try {
            const girl = HaremGirl.getCurrentGirl();
            return girl.nb_grades > girl.graded && HaremGirl.getMaxOutButton(HaremGirl.AFFECTION_TYPE).length > 0;
        } catch (error) {
            logHHAuto("ERROR can't compute canGiftGirl");
            return false;
        }
    }

    static canAwakeGirl(): boolean {
        try {
            const girl = HaremGirl.getCurrentGirl();
            const numberOfGem = unsafeWindow.player_gems_amount[girl.element].amount;
            return numberOfGem >= girl.awakening_costs;
        } catch (error) {
            logHHAuto("ERROR can't compute canAwakeGirl");
            return false;
        }
    }
    
    static moduleHaremGirl()
    {
        try {
            const canAwakeGirl = HaremGirl.canAwakeGirl();
            //const canGiftGirl = HaremGirl.canGiftGirl();
            const girl: KKHaremGirl = HaremGirl.getCurrentGirl();
            const numberOfGem = unsafeWindow.player_gems_amount[girl.element].amount;
            //logHHAuto("moduleHaremGirl: " + girl.id_girl);
            logHHAuto("Current level : " + girl.level + ', max level without gems : ' + girl.level_cap);
            logHHAuto("Number of gem needed in next awakening : " + girl.awakening_costs +" / Gem in stock : " + numberOfGem);
            logHHAuto("Girl grade : " + girl.graded + '/' + girl.nb_grades);

            const menuIDXp = "haremGirlGiveXP";
            const menuIDGifts = "haremGirlGiveGifts";

            var giveHaremXp = function() {HaremGirl.displayExpMenu(HaremGirl.EXPERIENCE_TYPE);};
            //var giveHaremGifts = function() {HaremGirl.displayExpMenu(HaremGirl.AFFECTION_TYPE);};

            if(canAwakeGirl)
                GM_registerMenuCommand(getTextForUI(menuIDXp,"elementText"), giveHaremXp);
            //if(canGiftGirl) // Not supported yet
            //   GM_registerMenuCommand(getTextForUI(menuIDGifts,"elementText"), giveHaremGifts);

            if (getStoredValue(HHStoredVarPrefixKey + SK.showHaremTools) === "true") {
                HaremGirl.addGirlMenu();
            }

        } catch ({ errName, message }) {
            logHHAuto(`ERROR: Can't add menu girl: ${errName}, ${message}`);
            console.error(message);
        }
    }

    static showSkillButtons() {
        const showSkillButtons = getStoredValue(HHStoredVarPrefixKey + SK.showHaremSkillsButtons) === "true";
        if (showSkillButtons && $('.hhsingleskill').length <= 0) {
            $('.skill-upgrade-row ').each((index, row) => {
                const rowHasButton = $('button.blue_button_L:not([disabled])', $(row)).length > 0;
                const rowHasHHButton = $('.hhsingleskill', $(row)).length > 0;

                if (rowHasButton && !rowHasHHButton) {
                    $(row).append('<div class="tooltipHH">'
                        + '<span class="tooltipHHtext">' + getTextForUI('haremGirlUpSkill', "tooltip") + '</span>'
                        + '<label style="font-size: initial;" class="myButton hhsingleskill">' + getTextForUI('haremGirlUpSkill', "elementText")
                        + '</label></div>');
                }
            });

            $('.hhsingleskill').on("click", function () {
                const skillId = $(this).parents('.skill-upgrade-row').attr('skill-id');
                HaremGirl.singleSkillsUpgrade(skillId);
            });

            $(HaremGirl.SKILL_BUTTON_SELECTOR).on("click", function () {
                setTimeout(() => { HaremGirl.showSkillButtons() }, 500);
            });
        }
    }

    static async run(): Promise<boolean> {
        try {
            //const debugEnabled = getStoredValue(HHStoredVarPrefixKey + TK.Debug") === 'true';
            const haremItem = getStoredValue(HHStoredVarPrefixKey + TK.haremGirlActions);
            const haremGirlMode = getStoredValue(HHStoredVarPrefixKey + TK.haremGirlMode);
            const haremGirlEnd = getStoredValue(HHStoredVarPrefixKey + TK.haremGirlEnd) === 'true';
            const haremGirlLimit = getStoredValue(HHStoredVarPrefixKey + TK.haremGirlLimit);
            const moneyOnStart = Number(getStoredValue(HHStoredVarPrefixKey + TK.haremMoneyOnStart));
            let haremGirlSpent = moneyOnStart > 0 ? moneyOnStart - HeroHelper.getMoney() : 0;

            const canGiftGirl = HaremGirl.canGiftGirl();
            const canAwakeGirl = HaremGirl.canAwakeGirl();
            const girl: KKHaremGirl = HaremGirl.getCurrentGirl();

            if (!haremItem) {
                // No action to be peformed
                return false;
            }
            logHHAuto("run HaremGirl: " + girl.name + ' (' + girl.id_girl + '), level ' + girl.level + ', rarity: ' + girl.rarity);
            setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "false");
            logHHAuto("setting autoloop to false as action to be performed on girl");
            logHHAuto("Action to be performed (mode: " + haremGirlMode + ") : give " + haremItem);

            if (haremGirlMode === 'girl')
            {
                if (haremItem == HaremGirl.EXPERIENCE_TYPE && haremGirlLimit && (Number(girl.level) + 50) <= Number(haremGirlLimit)) {
                    logHHAuto("haremGirlLimit: " + haremGirlLimit);
                    HaremGirl.HaremDisplayGirlPopup(haremItem, girl.name + ' ' + girl.Xp.cur + "xp, level " + girl.level + "/" + haremGirlLimit, (1) * 5, haremGirlSpent);
                    if ((Number(girl.level) + 50) >= Number(haremGirlLimit)) {
                        await HaremGirl.maxOutButtonAndConfirm(haremItem, girl);
                        HaremGirl.HaremClearGirlPopup();

                        Harem.clearHaremToolVariables();
                    }
                    else
                        HaremGirl.maxOutAndAwake(haremItem, girl);
                } else if (haremItem == HaremGirl.AFFECTION_TYPE && (canGiftGirl)) {
                    HaremGirl.HaremDisplayGirlPopup(haremItem, girl.name + ' ' + girl.graded + "/" + girl.nb_grades + "star", 2, haremGirlSpent);
                    if (!(await HaremGirl.fillAllAffection())) {
                        logHHAuto("No more quest");
                        // No more quest
                        HaremGirl.HaremClearGirlPopup();
                        Harem.clearHaremToolVariables();
                        return false;
                    }
                // } else if (haremItem == HaremGirl.EQUIPMENT_TYPE) {
                // } else if (haremItem == HaremGirl.SKILLS_TYPE) {

                } else {
                    logHHAuto('ERROR, no action found to be executed. ', { haremItem: haremItem, canGiftGirl: canGiftGirl, canAwakeGirl: canAwakeGirl });
                    Harem.clearHaremToolVariables();
                    return false;
                }
                return true;
            }
            else if (haremGirlMode === 'list')
            {
                let nextGirlId = -1;
                let girlPosInList = 0;
                let remainingGirls = 0;
                let girlListProgress = '';
                const lastGirlListProgress = '<br />' + getTextForUI("giveLastGirl", "elementText");
                const moneyOnStart = Number(getStoredValue(HHStoredVarPrefixKey + TK.haremMoneyOnStart));
                let haremGirlSpent = moneyOnStart > 0 ? moneyOnStart - HeroHelper.getMoney() : 0;

                let filteredGirlsList = getStoredJSON(HHStoredVarPrefixKey + TK.filteredGirlsList, []);
                logHHAuto("filteredGirlsList", filteredGirlsList);
                if (filteredGirlsList && filteredGirlsList.length > 0) {
                    girlPosInList = filteredGirlsList.indexOf("" + girl.id_girl);
                    if (girlPosInList >= 0 && filteredGirlsList.length > (girlPosInList + 1)) {
                        remainingGirls = filteredGirlsList.length - girlPosInList - 1;
                        nextGirlId = filteredGirlsList[girlPosInList + 1];
                        girlListProgress = (girlPosInList + 1) + '/' + filteredGirlsList.length;
                    }
                } else {
                    logHHAuto("ERROR: no girls stored");
                }

                if (haremGirlEnd && haremItem == HaremGirl.AFFECTION_TYPE) {
                    if (girl.graded == girl.nb_grades && nextGirlId < 0) girlListProgress += lastGirlListProgress;
                    HaremGirl.HaremDisplayGirlPopup(haremItem, girl.name + ' ' + girl.graded + "/" + girl.nb_grades + "star : Girl " + girlListProgress, (remainingGirls + 1) * 5, haremGirlSpent);
                    if (await HaremGirl.fillAllAffection()) {
                        logHHAuto("Going to girl quest");
                        return true;
                    }
                } else if (haremGirlEnd && haremItem == HaremGirl.EXPERIENCE_TYPE ) {
                    HaremGirl.HaremDisplayGirlPopup(haremItem, getTextForUI("giveMaxingOut", "elementText") + ' ' + girl.name + ' : ' + girlListProgress, (remainingGirls + 1) * 5, haremGirlSpent);
                    await HaremGirl.fillAllExperience();

                } else if (haremItem == HaremGirl.SKILLS_TYPE) {
                    HaremGirl.HaremDisplayGirlPopup(haremItem, getTextForUI("giveMaxingOut", "elementText") + ' ' + girl.name + ' : ' + girlListProgress, (remainingGirls + 1) * 5, haremGirlSpent);

                    HaremGirl.switchTabs(HaremGirl.SKILLS_TYPE);
                    await TimeHelper.sleep(randomInterval(400, 700));

                    logHHAuto('Upgrade skills, Scroll available: ' + $('.main-skill-block .available-resources .resource-value').text());
                    await HaremGirl.fullSkillsUpgrade();
                    await TimeHelper.sleep(randomInterval(400, 700));
                } else {
                    const canMaxOut = HaremGirl.getMaxOutButton(haremItem).length > 0;
                    if (nextGirlId < 0) girlListProgress += lastGirlListProgress;
                    if (canMaxOut) {
                        HaremGirl.HaremDisplayGirlPopup(haremItem, getTextForUI("giveMaxingOut", "elementText") + ' ' + girl.name + ' : ' + girlListProgress, (remainingGirls + 1) * 5, haremGirlSpent);
                        await HaremGirl.maxOutButtonAndConfirm(haremItem, girl);
                    } else {
                        logHHAuto("Max out button not clickable or not found");
                        HaremGirl.HaremDisplayGirlPopup(haremItem, girl.name + ' ' + getTextForUI("giveMaxedOut", "elementText") + ' : ' + girlListProgress, (remainingGirls + 1) * 5, haremGirlSpent);
                    }
                }

                if (nextGirlId >= 0) {
                    logHHAuto('Go to next girl (' + nextGirlId + ') remaining ' + remainingGirls + ' girls');
                    gotoPage('/girl/' + nextGirlId, { resource: haremItem }, randomInterval(1500, 2500));
                    return true;
                } else {
                    logHHAuto("No more girls, go back to harem list");
                    gotoPage('/characters/' + girl.id_girl, {}, randomInterval(1500, 2500));
                    Harem.clearHaremToolVariables();
                }
            }
            else if (haremGirlMode === 'team') {
                const upgradeSkill = haremItem.indexOf(HaremGirl.SKILLS_TYPE) >= 0;
                const upgradeEquipment = haremItem.indexOf(HaremGirl.EQUIPMENT_TYPE) >= 0;
                let team: TeamData = getStoredJSON(HHStoredVarPrefixKey + TK.haremTeam, {} as TeamData);
                //logHHAuto(`Team to upgrade (${haremItem})`, team);


                let nextGirlId = -1;
                let girlPosInList = 0;
                let remainingGirls = 0;
                let girlListProgress = '';
                // const lastGirlListProgress = '<br />' + getTextForUI("giveLastGirl", "elementText");

                if (team && team.team && team.team.length > 0) {
                    girlPosInList = team.girlIds.indexOf(girl.id_girl);
                    if (girlPosInList >= 0 && team.team.length > (girlPosInList + 1)) {
                        remainingGirls = team.team.length - girlPosInList - 1;
                        nextGirlId = team.team[girlPosInList + 1].id_girl;
                        girlListProgress = (girlPosInList + 1) + '/' + team.team.length;
                    }
                }
                if (girlPosInList == 0) logHHAuto('Main girl from the team');


                if (upgradeEquipment) {
                    HaremGirl.switchTabs(HaremGirl.EQUIPMENT_TYPE);
                    await TimeHelper.sleep(randomInterval(400, 700));

                    HaremGirl.HaremDisplayGirlPopup(HaremGirl.EQUIPMENT_TYPE, getTextForUI("giveMaxingOut", "elementText") + ' ' + girl.name + ' : ' + girlListProgress, (remainingGirls + 1) * 5, haremGirlSpent);

                    $('#girl-equip').trigger('click');
                    await TimeHelper.sleep(randomInterval(400, 700));

                    await HaremGirl.optimizeEquipmentSlots(girl);
                }
                if (upgradeSkill) {
                    HaremGirl.switchTabs(HaremGirl.SKILLS_TYPE);
                    await TimeHelper.sleep(randomInterval(400, 700));

                    HaremGirl.HaremDisplayGirlPopup(HaremGirl.SKILLS_TYPE, getTextForUI("giveMaxingOut", "elementText") + ' ' + girl.name + ' : ' + girlListProgress, (remainingGirls + 1) * 5, haremGirlSpent);

                    logHHAuto('Upgrade skills, Scroll available: ' + $('.main-skill-block .available-resources .resource-value').text());
                    await HaremGirl.fullSkillsUpgrade(girlPosInList == 0 ? 5 : 4);
                    await TimeHelper.sleep(randomInterval(400, 700));
                }
                
                if (nextGirlId >= 0) {
                    logHHAuto('Go to next girl (' + nextGirlId + ') remaining ' + remainingGirls + ' girls');
                    gotoPage('/girl/' + nextGirlId, { resource: (HaremGirl.EXPERIENCE_TYPE) }, randomInterval(1500, 2500));
                    return true;
                } else {
                    // Todo end team.
                    logHHAuto("No more girls, go back to harem list");
                    gotoPage('/characters/' + girl.id_girl, {}, randomInterval(1500, 2500));
                    Harem.clearHaremToolVariables();
                }
                
            } else {
                setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "true");
                Harem.clearHaremToolVariables();
            }
        } catch ({ errName, message }) {
            logHHAuto(`ERROR: Can't add menu girl: ${errName}, ${message}`);
            console.error(message);
            setStoredValue(HHStoredVarPrefixKey + TK.autoLoop, "true");
            Harem.clearHaremToolVariables();
            return false;
        }
        return false;
    }

    static async singleSkillsUpgrade(skillId: string) {
        logHHAuto('Upgrade skill ' + skillId);
        try {
            let skillButton = $(`#skills .skill-upgrade .skill-upgrade-row[skill-id='${skillId}'] button.blue_button_L:not([disabled])`).first();
            if (skillButton.length > 0) {
                skillButton.trigger('click');
                await TimeHelper.sleep(randomInterval(400, 700));
                return await HaremGirl.singleSkillsUpgrade(skillId);
            }
        } catch (error) {
            logHHAuto("Can't remove popup_message_harem");
        }
        setTimeout(() => { HaremGirl.showSkillButtons() }, 200);
        return Promise.resolve();
    }

    static async fullSkillsUpgrade(maxTier=5) {
        try {
            let skillButton:JQuery<HTMLElement> | null = null;
            for(let i=0; i< HaremGirl.SKILL_ORDER_PRIO.length; i++) {
                skillButton = $(`#skills .skill-upgrade [skill-id='${HaremGirl.SKILL_ORDER_PRIO[i]}'] button.blue_button_L:not([disabled])`).first();
                if (skillButton.length > 0) break; // break loop at first found skill to upgrade
            }
            if (!skillButton || skillButton.length == 0) {
                skillButton = $(HaremGirl.SKILL_BUTTON_SELECTOR).first();
            }
            if(skillButton.length > 0) {
                const skillId = Number(skillButton.parents('.skill-upgrade-row').attr('skill-id') || -1);
                //logHHAuto('Upgrading skill id: ' + skillId + ' targeting tier: ' + maxTier);
                if(maxTier == 4 && skillId > 10) {
                    //logHHAuto('Max tier for sub skills reached, stopping upgrade for this skill');
                    return Promise.resolve();
                }
                skillButton.trigger('click');
                await TimeHelper.sleep(randomInterval(400, 700));
                return await HaremGirl.fullSkillsUpgrade(maxTier);
            }
        } catch (error) {
            logHHAuto("Can't remove popup_message_harem");
        }
        return Promise.resolve();
    }

    static HaremDisplayGirlPopup(haremItem,haremText,remainingTime, cost=0)
    {
        $(".girl-leveler-panel .girl-section, .waifu-page-container .girl-display, #harem_right .avatar-box").prepend(
            `<div id="popup_message_harem" class="HHpopup_message" name="popup_message_harem" style="" ><a id="popup_message_harem_close" class="close">&times;</a>
                ${ !!haremItem ? getTextForUI("give"+haremItem,"elementText") : ''} : <br>
                ${haremText} (${remainingTime}sec)
                ${(cost > 0) ? `<br>${getTextForUI("cost" + haremItem, "elementText")}: ${NumberHelper.nRounding(cost, 2, 0)}` : ''}
                </div>`);
        setTimeout(() => {
            $("#popup_message_harem_close").one("click", function() {
                Harem.clearHaremToolVariables();
                location.reload();
            });
        }, 200);
        
    }

    static HaremClearGirlPopup(retry = false)
    {
        try {
            $("#popup_message_harem").remove();
            if($("#popup_message_harem").length > 0 && !retry) {
                setTimeout(() => { HaremGirl.HaremClearGirlPopup(true)}, 1500);
            }
        } catch (error) {
            logHHAuto("Can't remove popup_message_harem");
        }
    }

    private static equipItem(girlId: number | string, armorId: number | string): Promise<any> {
        return new Promise((resolve) => {
            $.ajax({
                url: '/ajax.php',
                type: 'POST',
                data: {
                    action: 'girl_equipment_equip',
                    id_girl: girlId,
                    id_girl_armor: armorId,
                    sort_by: 'rarity',
                    sorting_order: 'asc'
                },
                dataType: 'json',
                success: function (data: any) {
                    logHHAuto(`equipItem response for armor ${armorId}: success=${data?.success}, keys=${JSON.stringify(Object.keys(data || {}))}`);
                    resolve(data);
                },
                error: function (xhr: any, status: string, error: string) {
                    logHHAuto(`equipItem HTTP error for armor ${armorId}: status=${status}, error=${error}, response=${xhr?.responseText?.substring(0, 200)}`);
                    resolve(null);
                }
            });
        });
    }

    private static scoreItem(item: any, girl: KKHaremGirl): { caracSum: number, resonanceMatches: number } {
        const c = item.caracs;
        const caracSum = (c.carac1 || 0) + (c.carac2 || 0) + (c.carac3 || 0) + (c.damage || 0) + (c.defense || 0) + (c.ego || 0);
        let resonanceMatches = 0;
        if (item.resonance_bonuses && !Array.isArray(item.resonance_bonuses)) {
            const rb = item.resonance_bonuses;
            if (rb.class && String(rb.class.identifier) === String(girl.class)) resonanceMatches++;
            if (rb.element && String(rb.element.identifier) === String(girl.element)) resonanceMatches++;
            if (rb.figure && String(rb.figure.identifier) === String(girl.figure)) resonanceMatches++;
        }
        return { caracSum, resonanceMatches };
    }

    private static findBestItem(items: any[], girl: KKHaremGirl): any {
        if (items.length === 0) return null;
        return items.sort((a, b) => {
            const sa = HaremGirl.scoreItem(a, girl);
            const sb = HaremGirl.scoreItem(b, girl);
            if (sb.caracSum !== sa.caracSum) return sb.caracSum - sa.caracSum;
            if (sb.resonanceMatches !== sa.resonanceMatches) return sb.resonanceMatches - sa.resonanceMatches;
            return ((b.caracs.carac1||0)+(b.caracs.carac2||0)+(b.caracs.carac3||0))
                 - ((a.caracs.carac1||0)+(a.caracs.carac2||0)+(a.caracs.carac3||0));
        })[0];
    }

    private static isBetter(candidate: any, current: any, girl: KKHaremGirl): boolean {
        if (!current || !current.caracs) return true;
        const sc = HaremGirl.scoreItem(candidate, girl);
        const se = HaremGirl.scoreItem(current, girl);
        if (sc.caracSum > se.caracSum) return true;
        if (sc.caracSum === se.caracSum && sc.resonanceMatches > se.resonanceMatches) return true;
        return false;
    }

    /**
     * Force the game's lazy-loaded inventory panel to render all items.
     * The game renders inventory items on-demand as the container is scrolled.
     * We scroll to the bottom repeatedly until the item count stabilises, then
     * back to the top so the game has rendered every item into the DOM.
     */
    private static async forceLoadAllInventoryItems(): Promise<number> {
        const countItems = () => $('.right-section .slot[data-d]').length;

        // Find ALL scrollable elements in the right section (element with scrollHeight > clientHeight)
        const scrollables: HTMLElement[] = [];
        document.querySelectorAll('.right-section, .right-section *').forEach((el) => {
            const h = el as HTMLElement;
            if (h.scrollHeight > h.clientHeight + 5) scrollables.push(h);
        });
        // Also try the document/body as fallback
        scrollables.push(document.scrollingElement as HTMLElement || document.body);

        let prevCount = countItems();
        logHHAuto(`forceLoadAllInventoryItems: found ${scrollables.length} scrollable elements, initial item count=${prevCount}`);

        // Require 2 consecutive stable iterations before breaking — a single
        // stable iteration can happen during a network hiccup while more items
        // are still loading (see issue #1573).
        let stableIterations = 0;
        for (let iter = 0; iter < 15; iter++) {
            // scroll each scrollable to its bottom and dispatch a scroll event
            for (const s of scrollables) {
                try {
                    s.scrollTop = s.scrollHeight;
                    s.dispatchEvent(new Event('scroll', { bubbles: true }));
                } catch { /* ignore */ }
            }
            await TimeHelper.sleep(randomInterval(400, 600));
            const curCount = countItems();
            if (curCount === prevCount) {
                stableIterations++;
                if (stableIterations >= 2) break;
            } else {
                stableIterations = 0;
                prevCount = curCount;
            }
        }
        // scroll back up so the chosen item's scrollIntoView works reliably
        for (const s of scrollables) {
            try { s.scrollTop = 0; } catch { /* ignore */ }
        }
        // Final settle delay: let the game finish rendering any late items
        // before the caller reads the DOM (see issue #1573).
        await TimeHelper.sleep(randomInterval(400, 600));
        return countItems();
    }

    static async optimizeEquipmentSlots(girl: KKHaremGirl) {
        const equipmentSlots = $('.equipment_slot');
        const slotCount = equipmentSlots.length;

        logHHAuto(`Optimize equipment: checking ${slotCount} slots for ${girl.name}`);

        // Iterate slots in reverse order (5 → 0) so slot 0 is processed last.
        // Slot 0 is the default active slot after the page loads; processing it
        // first made the game treat slot 0 as "already active" and silently
        // ignore item clicks — the equip button never committed the change.
        // By the time we reach slot 0 we have switched slots five times, so the
        // game's internal state is guaranteed to register a real transition
        // when we click slot 0 (see issue #1573).
        for (let i = slotCount - 1; i >= 0; i--) {
            const slot = equipmentSlots.eq(i);
            // DEBUG (issue #1573): capture slot state before click
            const beforeClasses = equipmentSlots.map((idx, el) => `${idx}:"${$(el).attr('class') || ''}"`).get().join(' | ');
            logHHAuto(`[DEBUG Slot ${i}] all slot classes BEFORE click: ${beforeClasses}`);
            slot.trigger('click');
            // DEBUG (issue #1573): capture slot state after click
            const afterClasses = equipmentSlots.map((idx, el) => `${idx}:"${$(el).attr('class') || ''}"`).get().join(' | ');
            logHHAuto(`[DEBUG Slot ${i}] all slot classes AFTER click: ${afterClasses}`);
            // Give the game time to kick off its inventory request for this slot
            // before we start scrolling to force-load items (see issue #1573).
            await TimeHelper.sleep(randomInterval(600, 900));

            // Force game to render all lazy-loaded inventory items into the DOM
            const totalItems = await HaremGirl.forceLoadAllInventoryItems();

            // Extra settle time after forceLoad so the game can fully attach event
            // handlers to items in the right panel before we click them (see issue #1573).
            // Without this wait, clicks on items are silently ignored and the equip button
            // stays disabled. Observed failure mode: slot 0 fails ~67% of the time without it.
            await TimeHelper.sleep(randomInterval(800, 1200));

            const equippedEl = slot.find('.slot[data-d]');
            let equippedData: any = null;
            if (equippedEl.length > 0 && equippedEl.attr('data-d')) {
                try { equippedData = JSON.parse(equippedEl.attr('data-d')!); } catch { /* ignore */ }
            }

            const targetSlotIndex = equippedData?.slot_index ?? (i + 1);

            const allDomItems: { el: JQuery<HTMLElement>, data: any }[] = [];
            $('.right-section .slot[data-d]').each(function () {
                const $el = $(this);
                const raw = $el.attr('data-d');
                if (!raw) return;
                try {
                    const data = JSON.parse(raw);
                    if (data && data.caracs) allDomItems.push({ el: $el, data });
                } catch { /* ignore */ }
            });

            // Filter candidates by slot_index so we don't compare pants to necklaces
            const inventoryItems = allDomItems.filter(it => Number(it.data.slot_index) === Number(targetSlotIndex));

            // Diagnostic: slot_index distribution + top rarities in inventory
            const slotDist: { [k: string]: number } = {};
            const rarityDist: { [k: string]: number } = {};
            for (const it of allDomItems) {
                const si = String(it.data.slot_index);
                slotDist[si] = (slotDist[si] || 0) + 1;
                const ra = String(it.data.rarity);
                rarityDist[ra] = (rarityDist[ra] || 0) + 1;
            }
            logHHAuto(`Slot ${i}: targetSlotIndex=${targetSlotIndex}, DOM items=${allDomItems.length}, candidates=${inventoryItems.length}, slot_index_dist=${JSON.stringify(slotDist)}, rarity_dist=${JSON.stringify(rarityDist)}, equipped=${equippedData ? `L${equippedData.level} ${equippedData.rarity} si=${equippedData.slot_index}` : 'none'}`);

            if (inventoryItems.length === 0) {
                logHHAuto(`Slot ${i}: no inventory items for slot_index=${targetSlotIndex}, skipping`);
                continue;
            }

            // Rank candidates: total stats, then resonance, then individual stats
            const sorted = inventoryItems.slice().sort((a, b) => {
                const sa = HaremGirl.scoreItem(a.data, girl);
                const sb = HaremGirl.scoreItem(b.data, girl);
                if (sb.caracSum !== sa.caracSum) return sb.caracSum - sa.caracSum;
                if (sb.resonanceMatches !== sa.resonanceMatches) return sb.resonanceMatches - sa.resonanceMatches;
                const ca = a.data.caracs, cb = b.data.caracs;
                return ((cb.carac1||0)+(cb.carac2||0)+(cb.carac3||0)) - ((ca.carac1||0)+(ca.carac2||0)+(ca.carac3||0));
            });
            const bestInventory = sorted[0];

            const bestScore = HaremGirl.scoreItem(bestInventory.data, girl);
            const shouldReplace = HaremGirl.isBetter(bestInventory.data, equippedData, girl);

            if (shouldReplace) {
                logHHAuto(`Slot ${i}: replacing with better item (L${bestInventory.data.level} ${bestInventory.data.rarity}, score=${bestScore.caracSum}, resonance=${bestScore.resonanceMatches})`);
                // Capture previous equipped identity so we can verify a real change below (see issue #1573)
                const previousEquippedKey = equippedData ? (equippedData.id_item ?? equippedData.id_equipement ?? JSON.stringify(equippedData)) : null;
                const MAX_EQUIP_ATTEMPTS = 3;
                let equipSucceeded = false;

                // Helper: parent chain up to `maxDepth` or until root, "tag.cls1.cls2" per level
                const buildParentChain = ($el: JQuery<HTMLElement>, maxDepth: number): string[] => {
                    const chain: string[] = [];
                    let p = $el.parent();
                    for (let d = 0; d < maxDepth && p.length > 0; d++) {
                        const pEl = p.get(0) as HTMLElement | undefined;
                        const cls = (p.attr('class') || '').split(/\s+/).filter(c => c).slice(0, 3).join('.');
                        chain.push(`${pEl?.tagName?.toLowerCase() || '?'}${cls ? '.' + cls : ''}`);
                        p = p.parent();
                    }
                    return chain;
                };

                // Helper: global DOM counts relevant to equipment UI
                const domSnapshot = () => ({
                    rightSection: $('.right-section').length,
                    inventoryScroll: $('.inventory.hh-scroll').length,
                    girlLevelerPanel: $('.girl-leveler-panel').length,
                    filledSlots: $('.right-section .slot[data-d]').length,
                    selectedSlots: $('.right-section .inventory-slot.selected, .right-section .filled-slot.selected').length
                });

                // ISSUE #1573: Detach can happen between scroll and click, not before the attempt
                // loop. The isConnected check + re-query is now performed INSIDE the loop, after
                // scroll+sleep, right before the primary click. Massive diagnostics wrapped around
                // every step so we can see exactly when and why the node detaches.

                for (let attempt = 1; attempt <= MAX_EQUIP_ATTEMPTS; attempt++) {
                    // ========== PRE-SCROLL SNAPSHOT ==========
                    const rawPreScroll = bestInventory.el.get(0);
                    const preScrollConn = rawPreScroll?.isConnected;
                    const preScrollBody = rawPreScroll ? document.body.contains(rawPreScroll) : false;
                    const preScrollParents = buildParentChain(bestInventory.el, 12);
                    const preScrollDom = domSnapshot();
                    logHHAuto(`[DEBUG Slot ${i} att ${attempt}] PRE-SCROLL: connected=${preScrollConn} bodyContains=${preScrollBody} domCounts=${JSON.stringify(preScrollDom)} parents=[${preScrollParents.join(' > ')}]`);

                    // ========== SCROLL INTO VIEW ==========
                    if (rawPreScroll && typeof rawPreScroll.scrollIntoView === 'function') {
                        rawPreScroll.scrollIntoView({ block: 'center' });
                        // Synchronous state right after scroll (before any sleep) — detects detach during scroll itself
                        logHHAuto(`[DEBUG Slot ${i} att ${attempt}] POST-SCROLL sync: connected=${rawPreScroll.isConnected} bodyContains=${document.body.contains(rawPreScroll)}`);
                        await TimeHelper.sleep(randomInterval(200, 300));
                    }

                    // ========== POST-SLEEP STATE ==========
                    const rawPostSleep = bestInventory.el.get(0);
                    const postSleepConn = rawPostSleep?.isConnected;
                    const postSleepVisible = rawPostSleep ? rawPostSleep.offsetParent !== null : false;
                    const postSleepBody = rawPostSleep ? document.body.contains(rawPostSleep) : false;
                    const postSleepParents = buildParentChain(bestInventory.el, 12);
                    const postSleepDom = domSnapshot();
                    logHHAuto(`[DEBUG Slot ${i} att ${attempt}] POST-SLEEP: connected=${postSleepConn} visible=${postSleepVisible} bodyContains=${postSleepBody} domCounts=${JSON.stringify(postSleepDom)} parents=[${postSleepParents.join(' > ')}]`);

                    // ========== RE-QUERY IF DETACHED ==========
                    let raw: HTMLElement | undefined = rawPostSleep;
                    if (!raw || !raw.isConnected) {
                        const targetArmorId = bestInventory.data?.id_girl_armor;
                        logHHAuto(`[DEBUG Slot ${i} att ${attempt}] DETACHED — attempting re-query for id_girl_armor=${targetArmorId}`);
                        if (targetArmorId != null) {
                            const candidates = $('.right-section .slot[data-d]').filter(function () {
                                try {
                                    const d = JSON.parse($(this).attr('data-d') || '{}');
                                    return d.id_girl_armor === targetArmorId;
                                } catch { return false; }
                            });
                            logHHAuto(`[DEBUG Slot ${i} att ${attempt}] re-query found ${candidates.length} candidate(s)`);
                            candidates.each(function (idx) {
                                const $c = $(this);
                                const cRaw = $c.get(0);
                                const cConn = cRaw?.isConnected;
                                const cBody = cRaw ? document.body.contains(cRaw) : false;
                                const cParents = buildParentChain($c, 8);
                                logHHAuto(`[DEBUG Slot ${i} att ${attempt}] candidate[${idx}]: connected=${cConn} bodyContains=${cBody} parents=[${cParents.join(' > ')}]`);
                            });
                            const $fresh = candidates.filter(function () {
                                const r = $(this).get(0);
                                return !!r && r.isConnected;
                            }).first();
                            if ($fresh.length > 0) {
                                const freshRaw = $fresh.get(0)!;
                                logHHAuto(`[DEBUG Slot ${i} att ${attempt}] RE-QUERY SUCCESS — swapping to fresh node`);
                                bestInventory.el = $fresh;
                                raw = freshRaw;
                                // Scroll the fresh node into view, then re-check
                                if (typeof raw.scrollIntoView === 'function') {
                                    raw.scrollIntoView({ block: 'center' });
                                    await TimeHelper.sleep(randomInterval(200, 300));
                                    logHHAuto(`[DEBUG Slot ${i} att ${attempt}] POST-RE-SCROLL: connected=${raw.isConnected} bodyContains=${document.body.contains(raw)}`);
                                }
                            } else {
                                logHHAuto(`Slot ${i}: no connected candidate after re-query (id_girl_armor=${targetArmorId}), aborting attempts`);
                                break;
                            }
                        } else {
                            logHHAuto(`Slot ${i}: detached and no id_girl_armor to re-query, aborting attempts`);
                            break;
                        }
                    }

                    // ========== PRE-CLICK STATE (for the node we will actually click) ==========
                    {
                        const itemCls = bestInventory.el.attr('class') || '';
                        const itemId = bestInventory.el.attr('data-id') || '';
                        const connected = raw?.isConnected;
                        const visible = raw ? raw.offsetParent !== null : false;
                        const bodyContains = raw ? document.body.contains(raw) : false;
                        const outerH = (raw?.outerHTML || '').substring(0, 400);
                        const parentChain = buildParentChain(bestInventory.el, 12);
                        logHHAuto(`[DEBUG Slot ${i} att ${attempt}] PRE-CLICK: class="${itemCls}" data-id="${itemId}" connected=${connected} visible=${visible} bodyContains=${bodyContains} parents=[${parentChain.join(' > ')}] html="${outerH}"`);
                    }

                    // ========== PRIMARY CLICK ==========
                    const usedNative = !!(raw && typeof raw.click === 'function');
                    if (usedNative) {
                        raw!.click();
                    } else {
                        bestInventory.el.trigger('click');
                    }
                    logHHAuto(`[DEBUG Slot ${i} att ${attempt}] primary click dispatched (native=${usedNative})`);
                    // Short wait so the primary click can propagate before we check the button
                    await TimeHelper.sleep(randomInterval(300, 500));

                    // ========== POST-PRIMARY STATE ==========
                    {
                        const btnProbe = $('#girl-equipment-equip');
                        const btnDisabled = btnProbe.length === 0 || btnProbe.prop('disabled') === true || btnProbe.hasClass('disabled');
                        const rightSelectedStr = $('.right-section .selected, .right-section .active, .right-section .highlight')
                            .map((_, el) => {
                                const cls = ($(el).attr('class') || '').split(/\s+/).slice(0, 4).join('.');
                                return `${(el as HTMLElement).tagName?.toLowerCase() || '?'}${cls ? '.' + cls : ''}`;
                            }).get().join(' | ');
                        logHHAuto(`[DEBUG Slot ${i} att ${attempt}] POST-PRIMARY: connected=${raw?.isConnected} bodyContains=${raw ? document.body.contains(raw) : 'null'} btnDisabled=${btnDisabled} domCounts=${JSON.stringify(domSnapshot())} rightSelected="${rightSelectedStr || 'none'}"`);
                    }

                    // ========== FALLBACK CLICKS IF EQUIP BTN STILL DISABLED ==========
                    const $btnProbe = $('#girl-equipment-equip');
                    const btnStillDisabled = $btnProbe.length === 0
                        || $btnProbe.prop('disabled') === true
                        || $btnProbe.hasClass('disabled');
                    if (btnStillDisabled && raw) {
                        logHHAuto(`[DEBUG Slot ${i} att ${attempt}] BTN still disabled — running fallback clicks`);
                        // Fallback 1: synthetic MouseEvent with bubbles + view
                        try {
                            raw.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                        } catch (e) { logHHAuto(`[DEBUG Slot ${i} att ${attempt}] fallback 1 threw: ${e}`); }
                        await TimeHelper.sleep(200);
                        logHHAuto(`[DEBUG Slot ${i} att ${attempt}] after fallback 1 (MouseEvent click): btnDisabled=${$('#girl-equipment-equip').prop('disabled')} connected=${raw.isConnected} selectedCount=${$('.right-section .inventory-slot.selected, .right-section .filled-slot.selected').length}`);
                        // Fallback 2: full mousedown + mouseup + click sequence
                        try {
                            raw.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                            raw.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                            raw.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                        } catch (e) { logHHAuto(`[DEBUG Slot ${i} att ${attempt}] fallback 2 threw: ${e}`); }
                        await TimeHelper.sleep(200);
                        logHHAuto(`[DEBUG Slot ${i} att ${attempt}] after fallback 2 (full mouse seq): btnDisabled=${$('#girl-equipment-equip').prop('disabled')} connected=${raw.isConnected} selectedCount=${$('.right-section .inventory-slot.selected, .right-section .filled-slot.selected').length}`);
                        // Fallback 3: jQuery trigger
                        bestInventory.el.trigger('click');
                        await TimeHelper.sleep(200);
                        logHHAuto(`[DEBUG Slot ${i} att ${attempt}] after fallback 3 (jQuery trigger): btnDisabled=${$('#girl-equipment-equip').prop('disabled')} connected=${raw.isConnected} selectedCount=${$('.right-section .inventory-slot.selected, .right-section .filled-slot.selected').length}`);
                    }

                    // ========== AFTER-CLICK STATE (full) ==========
                    {
                        const rawElAfter = bestInventory.el.get(0);
                        const itemClsAfter = bestInventory.el.attr('class') || '';
                        const connectedAfter = rawElAfter?.isConnected;
                        const bodyContainsAfter = rawElAfter ? document.body.contains(rawElAfter) : false;
                        const rightSelected = $('.right-section .selected, .right-section .active, .right-section .highlight')
                            .map((_, el) => {
                                const cls = ($(el).attr('class') || '').split(/\s+/).slice(0, 4).join('.');
                                return `${(el as HTMLElement).tagName?.toLowerCase() || '?'}${cls ? '.' + cls : ''}`;
                            }).get().join(' | ');
                        logHHAuto(`[DEBUG Slot ${i} att ${attempt}] AFTER-CLICK: class="${itemClsAfter}" connected=${connectedAfter} bodyContains=${bodyContainsAfter} domCounts=${JSON.stringify(domSnapshot())} right-selected="${rightSelected || 'none'}"`);
                    }
                    // Additional wait so the game has time to activate the Equip button (see issue #1573)
                    await TimeHelper.sleep(randomInterval(400, 700));

                    // Click the Equip confirm button (revealed after item selection)
                    let $equipBtn = $('#girl-equipment-equip').removeClass('hidden').removeAttr('hidden');
                    // Wait up to ~500ms for the button to become enabled (see issue #1573)
                    for (let waitIter = 0; waitIter < 5 && $equipBtn.length > 0
                        && ($equipBtn.prop('disabled') === true || $equipBtn.hasClass('disabled')); waitIter++) {
                        await TimeHelper.sleep(100);
                        $equipBtn = $('#girl-equipment-equip').removeClass('hidden').removeAttr('hidden');
                    }

                    if ($equipBtn.length > 0) {
                        // DEBUG (issue #1573): equip button state BEFORE click (attempt 1 only)
                        if (attempt === 1) {
                            const btnEl = $equipBtn.get(0) as HTMLElement | undefined;
                            const btnHtml = (btnEl?.outerHTML || '').substring(0, 400);
                            logHHAuto(`[DEBUG Slot ${i}] equip btn BEFORE click: disabled=${$equipBtn.prop('disabled')} hidden-attr=${$equipBtn.attr('hidden') ?? 'none'} classes="${$equipBtn.attr('class') || ''}" html="${btnHtml}"`);
                        }
                        const btnRaw = $equipBtn.get(0) as HTMLElement | undefined;
                        if (btnRaw && typeof btnRaw.click === 'function') btnRaw.click();
                        else $equipBtn.trigger('click');
                        await TimeHelper.sleep(randomInterval(400, 700));
                        logHHAuto(`Slot ${i}: equip button clicked (attempt ${attempt}/${MAX_EQUIP_ATTEMPTS})`);
                        // DEBUG (issue #1573): equip button state AFTER click (attempt 1 only)
                        if (attempt === 1) {
                            const btnAfter = $('#girl-equipment-equip').get(0) as HTMLElement | undefined;
                            const btnAfterHtml = (btnAfter?.outerHTML || '').substring(0, 400);
                            logHHAuto(`[DEBUG Slot ${i}] equip btn AFTER click: html="${btnAfterHtml}"`);
                        }
                    } else {
                        logHHAuto(`Slot ${i}: #girl-equipment-equip not found (attempt ${attempt}/${MAX_EQUIP_ATTEMPTS})`);
                    }

                    // Verify the equipped item actually changed (see issue #1573)
                    await TimeHelper.sleep(randomInterval(300, 500));
                    const verifyEl = slot.find('.slot[data-d]');
                    let verifyData: any = null;
                    if (verifyEl.length > 0 && verifyEl.attr('data-d')) {
                        try { verifyData = JSON.parse(verifyEl.attr('data-d')!); } catch { /* ignore */ }
                    }
                    const verifyKey = verifyData ? (verifyData.id_item ?? verifyData.id_equipement ?? JSON.stringify(verifyData)) : null;
                    if (verifyKey !== previousEquippedKey) {
                        logHHAuto(`Slot ${i}: equip verified (L${verifyData?.level} ${verifyData?.rarity})`);
                        equipSucceeded = true;
                        break;
                    }
                    logHHAuto(`Slot ${i}: equip NOT verified, previous item still equipped (attempt ${attempt}/${MAX_EQUIP_ATTEMPTS})`);
                    if (attempt < MAX_EQUIP_ATTEMPTS) {
                        await TimeHelper.sleep(randomInterval(500, 800));
                    }
                }
                if (!equipSucceeded) {
                    logHHAuto(`Slot ${i}: equip failed after ${MAX_EQUIP_ATTEMPTS} attempts, skipping`);
                }
            } else {
                const eqScore = equippedData ? HaremGirl.scoreItem(equippedData, girl) : null;
                logHHAuto(`Slot ${i}: current item is optimal (L${equippedData?.level} ${equippedData?.rarity}, score=${eqScore?.caracSum})`);
            }
        }
        logHHAuto('Equipment optimization complete');
    }
}
