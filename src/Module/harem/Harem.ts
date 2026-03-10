// Harem.ts -- Harem management: girl list, filtering, and size tracking.
//
// The harem is the player's collection of girls, each with stats and upgrade
// paths. This module provides the core harem functionality: loading the girl
// list, filtering by various criteria, tracking harem size, and managing
// the harem page UI interactions.
//
// Depends on: HaremGirl.ts (individual girl data)
// Used by: Service/index.ts (main automation loop), EventModule.ts (girl tracking)
//
import {
    deleteStoredValue,
    ConfigHelper,
    getHHVars,
    getStoredValue,
    getStoredJSON,
    getTextForUI,
    setStoredValue,
    getPage,
    HeroHelper
} from '../../Helper/index';
import { gotoPage } from '../../Service/index';
import { fillHHPopUp, isJSON, logHHAuto, maskHHPopUp, safeJsonParse } from '../../Utils/index';
import { HHStoredVarPrefixKey, SK, TK } from '../../config/index';
import { KKHaremGirl, KKHaremSalaryGirl } from '../../model/index';


export class Harem {
    static HAREM_UPGRADE_LAST_ACTION='haremGirl';
    static filterGirlMapCanUpgrade(a:any)
    {
        return a.gData.can_upgrade;
    }

    static clearHaremToolVariables()
    {
        // logHHAuto('clearHaremToolVariables');
        deleteStoredValue(HHStoredVarPrefixKey + TK.haremGirlActions);
        deleteStoredValue(HHStoredVarPrefixKey + TK.haremGirlMode);
        deleteStoredValue(HHStoredVarPrefixKey + TK.haremGirlEnd);
        deleteStoredValue(HHStoredVarPrefixKey + TK.haremGirlPayLast);
        deleteStoredValue(HHStoredVarPrefixKey + TK.haremGirlLimit);
        deleteStoredValue(HHStoredVarPrefixKey + TK.haremMoneyOnStart);
        deleteStoredValue(HHStoredVarPrefixKey + TK.haremGirlSpent);
        
        const lastActionPerformed:string = getStoredValue(HHStoredVarPrefixKey+TK.lastActionPerformed);
        if(lastActionPerformed == Harem.HAREM_UPGRADE_LAST_ACTION) {
            setStoredValue(HHStoredVarPrefixKey+TK.lastActionPerformed, "none");
        }
    }

    static getGirlMapSorted(inSortType = "DateAcquired",inSortReversed = true )
    {
        let girlsMap = getHHVars("shared.GirlSalaryManager.girlsMap");
        // if (girlsMap === null) {
        //     girlsMap = getHHVars("girlsDataList");
        // }
        if (girlsMap !== null)
        {

            girlsMap = Object.values(girlsMap);
            if (girlsMap.length > 0)
            {
                //console.log(inSortType);
                if (ConfigHelper.getHHScriptVars("haremSortingFunctions").hasOwnProperty(inSortType))
                {
                    girlsMap.sort(ConfigHelper.getHHScriptVars("haremSortingFunctions")[inSortType]);
                }
                else
                {
                    logHHAuto("Unknown sorting function, returning Girls Map sorted by date acquired.");
                    girlsMap.sort(ConfigHelper.getHHScriptVars("haremSortingFunctions").DateAcquired);
                }
            }
            if (inSortReversed)
            {
                girlsMap.reverse();
            }
            /*for(let i=0;i<5;i++)
                console.log(girlsMap[i].gData.name, getGirlUpgradeCost(girlsMap[i].gData.rarity, girlsMap[i].gData.graded + 1));*/
        }
        return girlsMap;
    }

    
    static getGirlsList(): Map<string,any> {
        let girlsDataList: Map<string, any> | any = Harem.getHaremGirlsFromOcdIfExist();
        if (girlsDataList == null && getPage() === ConfigHelper.getHHScriptVars("pagesIDEditTeam")) {
            girlsDataList = getHHVars("availableGirls");
        }
        if (girlsDataList == null && getPage() === ConfigHelper.getHHScriptVars("pagesIDWaifu")) {
            girlsDataList = getHHVars("girls_data_list");
        }
        if (girlsDataList == null) {
            girlsDataList = getHHVars("girlsDataList");
        }
        if (girlsDataList != null && !(girlsDataList instanceof Map)) {
            let girlNameDictionary = new Map();
            girlsDataList.forEach((data: any) => {
                girlNameDictionary.set(data.id_girl +"", data);
            });
            girlsDataList = girlNameDictionary;
        }
        return girlsDataList;
    }

    static getHaremGirlsFromOcdIfExist(): Map<string, any> {
        if (localStorage.getItem('HHS.HHPNMap') !== null) {
            try {
                const girlsArray = safeJsonParse(localStorage.getItem('HHS.HHPNMap'), null);
                let girlNameDictionary = new Map();
                girlsArray.forEach((data:any) => {
                    girlNameDictionary.set(data[0]+"", data[1]);
                });
                return girlNameDictionary;
            } catch (error) {
                return null;
            }
        } else {
            return null;
        }
    }

    static getGirlData(girlId: number){
        var gMap = getHHVars('girls_data_list') || getHHVars('availableGirls');
        if (gMap === null) {
            // error
            //logHHAuto("Girls Map was undefined...! Error, cannot export girls.");
        }
        else {
            return gMap.find((girl) => girl.id_girl == girlId);
        }
        return null;
    }

    static moduleHaremExportGirlsData()
    {
        const menuID = "ExportGirlsData";
        let styles = 'position: absolute;left: 870px;top: 80px;width:24px;z-index:10';
        if (getPage() === ConfigHelper.getHHScriptVars("pagesIDWaifu")) {
            styles = 'position: absolute;top: 10px;width:24px;z-index:10';
        }
        let ExportGirlsData = `<div style="${styles}" class="tooltipHH" id="${menuID}"><span class="tooltipHHtext">${getTextForUI("ExportGirlsData","tooltip")}</span><label style="font-size:small" class="myButton" id="ExportGirlsDataButton">${getTextForUI("ExportGirlsData","elementText")}</label></div>`;
        if (document.getElementById(menuID) === null)
        {
            $("#filter_girls").after(ExportGirlsData);
            $("#ExportGirlsDataButton").on("click", saveHHGirlsAsCSV);
            GM_registerMenuCommand(getTextForUI(menuID,"elementText"), saveHHGirlsAsCSV);
        }
        else
        {
            return;
        }


        function saveHHGirlsAsCSV() {
            var dataToSave="";
            dataToSave = extractHHGirls();
            var name='HH_GirlData_'+Date.now()+'.csv';
            const a = document.createElement('a')
            a.download = name
            a.href = URL.createObjectURL(new Blob([dataToSave], {type: 'text/plain'}))
            a.click()
        }

        function extractHHGirls()
        {
            var dataToSave = "Name,Rarity,Class,Figure,Level,Stars,Of,Left,Hardcore,Charm,Know-how,Total,Position,Eyes,Hair,Zodiac,Own,Element\r\n";
            var gMap = getHHVars('girls_data_list') || getHHVars('availableGirls');
            if(gMap === null)
            {
                // error
                logHHAuto("Girls Map was undefined...! Error, cannot export girls.");
            }
            else
            {
                try{
                    var cnt = 1;
                    for(var key in gMap)
                    {
                        cnt++;
                        var gData = gMap[key];
                        dataToSave += gData.name + ",";
                        dataToSave += gData.rarity + ",";
                        dataToSave += gData.class + ",";
                        dataToSave += gData.figure + ",";
                        dataToSave += gData.level + ",";
                        dataToSave += gData.graded + ",";
                        dataToSave += gData.nb_grades + ",";
                        dataToSave += Number(gData.nb_grades)-Number(gData.graded) + ",";
                        dataToSave += gData.caracs.carac1 + ",";
                        dataToSave += gData.caracs.carac2 + ",";
                        dataToSave += gData.caracs.carac3 + ",";
                        dataToSave += Number(gData.caracs.carac1)+Number(gData.caracs.carac2)+Number(gData.caracs.carac3) + ",";
                        dataToSave += gData.position_img + ",";
                        dataToSave += gData.eye_color1 + ","; // TODO update with user friendly color
                        dataToSave += gData.hair_color1 + ","; // TODO update with user friendly color
                        dataToSave += gData.zodiac.substring(3) + ",";
                        dataToSave += true + ",";
                        dataToSave += gData.element + "\r\n";

                    }
                    //            logHHAuto(dataToSave);

                }
                catch(exp){
                    // error
                    logHHAuto("Catched error : Girls Map had undefined property...! Error, cannot export girls : "+exp);
                }
            }
            return dataToSave;
        }

        function stripSpan(tmpStr:string)
        {
            var newStr = "";
            while(tmpStr.indexOf(">") > -1)
            {
                tmpStr = tmpStr.substring(tmpStr.indexOf(">") + 1);
                newStr += tmpStr.slice(0, tmpStr.indexOf("<"));
                //        tmpStr = tmpStr.substring(tmpStr.indexOf(">")+1);
            }
            return newStr;
        }
    }

    static getFilteredGirlList(): string[]  {
        // Store girls for harem tools
        let filteredGirlsList:string[] = [];
        const girlListDisplayed = getHHVars("shared.GirlSalaryManager.girlsMap");
        const girlsListLoaded = getHHVars("girlsDataList");
        const girlsListSec = getHHVars("shared.GirlSalaryManager.girlsListSec");

        if (girlListDisplayed) {
            Object.values(girlListDisplayed).forEach((girl: KKHaremSalaryGirl) => {
                if (girl.gData.shards >= 100) filteredGirlsList.push("" + girl.gId);
            });
        }
        else if (girlsListLoaded) {
            Object.values(girlsListLoaded).forEach((girl: KKHaremGirl) => {
                if (girl.shards >= 100) filteredGirlsList.push("" + girl.id_girl);
            });
        }
        else if (girlsListSec.length > 0) {
            girlsListSec.forEach((girl) => {
                if (girl.gData.shards >= 100) filteredGirlsList.push(""+girl.gId);
            });
        }
        return filteredGirlsList;
    }

    static getGirlCount(): number  {
        // Store girls for harem tools
        let girlCount = getStoredJSON(HHStoredVarPrefixKey + TK.HaremSize, {count: 0}).count;
        const girlsDataList = getHHVars("girlsDataList", false);
        const girlsListSec = getHHVars("shared.GirlSalaryManager.girlsListSec");

        if (girlCount == 0 && girlsDataList) {
            girlCount = Object.values(girlsDataList).length;
        }
        if (girlCount == 0 && girlsListSec.length > 0) {
            girlCount = girlsListSec.length;
        }

        return girlCount;
    }

    static moduleHarem()
    {
        const menuIDXp = "haremGiveXP";
        const menuIDGifts = "haremGiveGifts";

        let menuHidden = `<div style="visibility:hidden" id="${menuIDXp}"></div>`;
        if (document.getElementById(menuIDXp) === null)
        {
            // Avoid looping on add menu item
            $("#contains_all section").prepend(menuHidden);

            var giveHaremXp = function() { Harem.fillCurrentGirlItem('experience');};
            var giveHaremGifts = function() { Harem.fillCurrentGirlItem('affection');};

            GM_registerMenuCommand(getTextForUI(menuIDXp,"elementText"), giveHaremXp);
            GM_registerMenuCommand(getTextForUI(menuIDGifts,"elementText"), giveHaremGifts);
        }

        Harem.addGoToGirlPageButton();
        Harem.addGirlListMenu();
    }

    static fillCurrentGirlItem(haremItem, payLast=false){
        let filteredGirlsList = Harem.getFilteredGirlList();
        const displayedGirl = $('#harem_right .opened').attr('girl'); // unsafeWindow.harem.preselectedGirlId

        if (filteredGirlsList && filteredGirlsList.length > 0) {
            let girlToGoTo = filteredGirlsList[0];
            // if(displayedGirl && filteredGirlsList.indexOf(""+displayedGirl) >=0) {
            //     girlToGoTo = displayedGirl;
            // }
            logHHAuto("Go to " + girlToGoTo);
            gotoPage('/girl/'+girlToGoTo,{resource:haremItem});
            setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");
            logHHAuto("setting autoloop to false");
        }
        setStoredValue(HHStoredVarPrefixKey+TK.haremGirlActions, haremItem);
        setStoredValue(HHStoredVarPrefixKey+TK.haremGirlMode, 'list');
        if (! (Number(getStoredValue(HHStoredVarPrefixKey + TK.haremMoneyOnStart)) > 0)) {
            logHHAuto('set money to ' + HeroHelper.getMoney());
            setStoredValue(HHStoredVarPrefixKey + TK.haremMoneyOnStart, HeroHelper.getMoney());
        }
        if (payLast) setStoredValue(HHStoredVarPrefixKey+TK.haremGirlPayLast, 'true');
        setStoredValue(HHStoredVarPrefixKey+TK.filteredGirlsList, JSON.stringify(filteredGirlsList));
        setStoredValue(HHStoredVarPrefixKey+TK.lastActionPerformed, Harem.HAREM_UPGRADE_LAST_ACTION);
    };

    static addGoToGirlPageButton(){
        const goToGirlPageButtonId = 'goToGirlPage';
        if($('#'+goToGirlPageButtonId).length > 0) return;

        const displayedGirl = $('#harem_right .opened').attr('girl') || ''; // unsafeWindow.harem.preselectedGirlId
        const girlOwned = displayedGirl != '' && $('#harem_right .opened .avatar-box:visible').length > 0;

        //GM_addStyle('#harem_right>div[girl] .middle_part div.avatar-box img.avatar { height: 365px; margin-bottom: 30px;}');
        //GM_addStyle('#harem_right>div[girl] .middle_part div.avatar-box canvas.animated-girl-display { height: 59rem; top: -18rem;}');
        GM_addStyle('.goToGirlPage {position: relative; bottom: 12px; left: 250px; font-size: small; width: fit-content; z-index:30;}');

        // using a for new tab option
        const goToGirlPageButton = '<div class="tooltipHH goToGirlPage"><span class="tooltipHHtext">' + getTextForUI("goToGirlPage", "tooltip") +'</span><a href="/girl/'+displayedGirl+'?resource=experience" class="myButton" id="'+goToGirlPageButtonId+'">'+getTextForUI("goToGirlPage","elementText")+'</a></div>';
        var goToGirl = function(){
            const displayedGirl = $('#harem_right .opened').attr('girl'); // unsafeWindow.harem.preselectedGirlId
            gotoPage('/girl/'+displayedGirl,{resource:'experience'});
        };
        $('#harem_right .middle_part').append(goToGirlPageButton);

        if(girlOwned) {
            GM_registerMenuCommand(getTextForUI('goToGirlPage',"elementText"), goToGirl);
        } else {
            $('#'+goToGirlPageButtonId).hide();
        }
    }

    static addGirlListMenu(){
        const girlListMenuButtonId = 'girlListMenu';
        if($('#'+girlListMenuButtonId).length > 0) return;

        var createMenuButton = function(menuId, disabled=false){
            return '<div class="tooltipHH">'
            +    '<span class="tooltipHHtext">'+getTextForUI(menuId,"tooltip")+'</span>'
            +    '<label style="font-size: initial;" class="myButton" '+(disabled?'disabled="disabled"':'')+' id="'+menuId+'Button">'+getTextForUI(menuId,"elementText")
            +'</label></div>';
        }
        
        const girlListMenuButton = '<div style="position: absolute;left: 250px;top: 35px; font-size: small; z-index:30;" class="tooltipHH"><span class="tooltipHHtext">'+getTextForUI("girlListMenu","tooltip")+'</span><label class="myButton" id="'+girlListMenuButtonId+'">+</label></div>';
        var openGirlMenu = function(){

            
            const menuIDXp = "haremGiveXP";
            const menuIDMaxXp = "haremGiveMaxXP";
            const menuIDGifts = "haremGiveGifts";
            const menuIDMaxGifts = "haremGiveMaxGifts";
            const menuIDUpgradeMax = "haremUpgradeMax";

            const menuIDMaxXpButton = createMenuButton(menuIDMaxXp);
            const menuIDXpButton = createMenuButton(menuIDXp);
            const menuIDGiftsButton = createMenuButton(menuIDGifts);
            const menuIDMaxGiftsButton = createMenuButton(menuIDMaxGifts);
            const menuIDUpgradeMaxButton = createMenuButton(menuIDUpgradeMax);
            const imgPath = ConfigHelper.getHHScriptVars("baseImgPath");

            
            const girlListMenu = '<div style="padding:50px; display:flex;flex-direction:column;width:400px">'
            // +    '<p id="HaremGirlListMenuText">'+getTextForUI("girlListMenu","elementText")+'</p>'
            +    '<div class="optionsBoxWithTitle">'
            +       '<div class="optionsBoxTitle"><img class="iconImg" src="'+imgPath+'/design/ic_books_gray.svg"><span class="optionsBoxTitle">'+getTextForUI("experience","elementText")+'</span></div>'
            +       '<div class="optionsBox">'
            +         '<div style="padding:10px">'+menuIDXpButton+'</div>'
            +         '<div style="padding:10px">'+menuIDMaxXpButton+'</div>'
            +       '</div>'
            +    '</div>'
            +    '<div class="optionsBoxWithTitle">'
            +       '<div class="optionsBoxTitle"><img class="iconImg" src="'+imgPath+'/design/ic_gifts_gray.svg"><span class="optionsBoxTitle">'+getTextForUI("affection","elementText")+'</span></div>'
            +       '<div class="optionsBox">'
            +         '<div style="padding:10px">'+menuIDGiftsButton+'</div>'
            +         '<div style="padding:10px">'+menuIDMaxGiftsButton+'</div>'
            +         '<div style="padding:10px">'+menuIDUpgradeMaxButton+'</div>'
            +       '</div>'
            +    '</div>'
            // +    '<div class="optionsBoxWithTitle">' // TODO fixme
            // +       '<div class="optionsBoxTitle"><img class="iconImg" src="'+imgPath+'/design_v2/affstar_upgrade.png"><span class="optionsBoxTitle">'+getTextForUI("upradable","elementText")+'</span></div>'
            // +       '<div class="optionsBox">'
            // +         '<div style="padding:10px">'+menuNextUpgradButton+'</div>'
            // +       '</div>'
            // +    '</div>'
            +  '</div>';
            fillHHPopUp("GirlListMenu",getTextForUI("girlListMenu","elementText"), girlListMenu);
            $('#'+menuIDXp+'Button').on("click", function() { Harem.fillCurrentGirlItem('experience');});
            $('#'+menuIDGifts+'Button').on("click", function() { Harem.fillCurrentGirlItem('affection');});
            $('#'+menuIDMaxGifts+'Button').on("click", function() {
                setStoredValue(HHStoredVarPrefixKey+TK.haremGirlEnd, 'true');
                Harem.fillCurrentGirlItem('affection');
            });$('#'+menuIDMaxXp+'Button').on("click", function() {
                setStoredValue(HHStoredVarPrefixKey+TK.haremGirlEnd, 'true');
                Harem.fillCurrentGirlItem('experience');
            });
            $('#'+menuIDUpgradeMax+'Button').on("click", function() {
                setStoredValue(HHStoredVarPrefixKey+TK.haremGirlEnd, 'true');
                Harem.fillCurrentGirlItem('affection', true);
            });
        };
        $('#harem_left').append(girlListMenuButton);

        GM_registerMenuCommand(getTextForUI('girlListMenu',"elementText"), openGirlMenu);
        $('#'+girlListMenuButtonId).on("click", openGirlMenu);
    }
   
    static HaremSizeNeedsRefresh(inCustomExpi)
    {
        return getStoredJSON(HHStoredVarPrefixKey+TK.HaremSize, {count_date: 0}).count_date < (new Date().getTime() - inCustomExpi * 1000);
    }

    static moduleHaremCountMax()
    {
        const girlList = getHHVars('girls_data_list', false) || getHHVars('availableGirls', false)
        if (Harem.HaremSizeNeedsRefresh(ConfigHelper.getHHScriptVars("HaremMinSizeExpirationSecs")) && girlList !== null)
        {
            setStoredValue(HHStoredVarPrefixKey + TK.HaremSize, JSON.stringify({ count: Object.keys(girlList).length,count_date:new Date().getTime()}));
            logHHAuto("Harem size updated to : " + Object.keys(girlList).length);
        }
    }

    static getGirlUpgradeCost(inRarity, inTargetGrade)
    {
        const rarity = ["starting", "common", "rare", "epic", "legendary", "mythic"];
        const rarityFactors = [1, 2, 6, 14, 20, 50];
        const gradeFactors = [1, 2.5, 2.5, 2, 2, 2];
        const cost11 = 36000;
        let calculatedCosts = {};
        for (let i = 0;i <rarity.length; i++)
        {
            let currentRarityCosts = {};
            for (let j = 0;j < 6;j++)
            {
                let currentCost;
                if (i === 0 && j === 0)
                {
                    //console.log("init 1");
                    currentCost = cost11;
                }
                else if ( j === 0 )
                {
                    //console.log("init -1");
                    currentCost = calculatedCosts[rarity[0]][0]*rarityFactors[i];
                }
                else
                {
                    //console.log("-1");
                    currentCost = currentRarityCosts[j-1]*gradeFactors[j];
                }

                currentRarityCosts[j] = currentCost;
            }
            //console.log(current);
            calculatedCosts[rarity[i]] = currentRarityCosts;
        }
        return calculatedCosts[inRarity][inTargetGrade];
    }
}