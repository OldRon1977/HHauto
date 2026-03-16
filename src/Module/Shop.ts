// Shop.ts -- Automates the equipment shop: buys and sells equipment, manages
// inventory.
//
// Handles automated interactions with the in-game equipment shop. Buys
// desired equipment, sells unwanted items, and manages inventory slots.
// Tracks shop refresh timers and available currency.
//
// Used by: Service/index.ts (main automation loop)
//
import {
    checkTimer,
    convertTimeToInt,
    ConfigHelper,
    getHHVars,
    getPage,
    getStoredValue,
    getStoredJSON,
    getTextForUI,
    randomInterval,
    setStoredValue,
    setTimer,
    HeroHelper
} from '../Helper/index';
import { autoLoop, gotoPage } from '../Service/index';
import { isJSON, logHHAuto, safeJsonParse } from '../Utils/index';
import { HHAuto_inputPattern, HHStoredVarPrefixKey, SK, TK } from '../config/index';
import { Booster } from "./Booster";

export class Shop {

    static isTimeToCheckShop() {
        const updateMarket = getStoredValue(HHStoredVarPrefixKey+SK.updateMarket)  === "true";
        const needBoosterStatus = Booster.needBoosterStatusFromStore();
        return (updateMarket || needBoosterStatus) && ( getStoredValue(HHStoredVarPrefixKey+SK.paranoia) !== "true" || !checkTimer("paranoiaSwitch") )
    }

    static updateShop()
    {
        if(getPage() !== ConfigHelper.getHHScriptVars("pagesIDShop"))
        {
            logHHAuto("Navigating to Market window.");
            gotoPage(ConfigHelper.getHHScriptVars("pagesIDShop"));
            return true;
        }
        else {
            logHHAuto("Detected Market Screen. Fetching Assortment");
    
            var assA:Record<string, unknown>[]=[];
            var assB:Record<string, unknown>[]=[];
            var assG:Record<string, unknown>[]=[];
            var assP:Record<string, unknown>[]=[];
            $('#shops div.armor.merchant-inventory-item .slot').each(function(){if (this.dataset.d)assA.push(JSON.parse(this.dataset.d));});
            $('#shops div.booster.merchant-inventory-item .slot').each(function(){if (this.dataset.d)assB.push(JSON.parse(this.dataset.d));});
            $('#shops div.gift.merchant-inventory-item .slot').each(function(){if (this.dataset.d)assG.push(JSON.parse(this.dataset.d));});
            $('#shops div.potion.merchant-inventory-item .slot').each(function(){if (this.dataset.d)assP.push(JSON.parse(this.dataset.d));});
    
            var HaveAff=0;
            var HaveExp=0;
            var HaveBooster={};
            $('#shops div.gift.player-inventory-content .slot').each(function(){if (this.dataset.d) { var d=JSON.parse(this.dataset.d); HaveAff+=d.quantity*d.item.value;}});
            $('#shops div.potion.player-inventory-content .slot').each(function(){if (this.dataset.d) { var d=JSON.parse(this.dataset.d); HaveExp+=d.quantity*d.item.value;}});
    
            var BoosterIdMap={};
            $('#shops div.booster.player-inventory-content .slot').each(function(){ if (this.dataset.d) { var d=JSON.parse(this.dataset.d); HaveBooster[d.item.identifier] = d.quantity; if(d.item.id_item) BoosterIdMap[d.item.identifier] = { id_item: String(d.item.id_item), identifier: d.item.identifier, name: d.item.name, rarity: d.item.rarity };}});
    
            setStoredValue(HHStoredVarPrefixKey+TK.haveAff, HaveAff);
            setStoredValue(HHStoredVarPrefixKey+TK.haveExp, HaveExp);
            setStoredValue(HHStoredVarPrefixKey+TK.haveBooster, JSON.stringify(HaveBooster));
            setStoredValue(HHStoredVarPrefixKey+TK.boosterIdMap, JSON.stringify(BoosterIdMap));

            logHHAuto('counted '+getStoredValue(HHStoredVarPrefixKey+TK.haveAff)+' Aff, '+getStoredValue(HHStoredVarPrefixKey+TK.haveExp)+' Exp, Booster: ' + JSON.stringify(HaveBooster));
            // Debug: log each booster found in player inventory with id_item and quantity
            for (const [identifier, data] of Object.entries(BoosterIdMap)) {
                const qty = HaveBooster[identifier] || 0;
                const entry = data as any;
                logHHAuto(`  Booster inventory: ${entry.name} [${identifier}] id_item=${entry.id_item} rarity=${entry.rarity} qty=${qty}`);
            }
    
            setStoredValue(HHStoredVarPrefixKey+TK.storeContents, JSON.stringify([assA,assB,assG,assP]));
            setStoredValue(HHStoredVarPrefixKey+TK.charLevel, HeroHelper.getLevel());
    
            var nshop;
            let shopFrozenTimer = $('.shop div.shop_count span[rel="expires"]').first().text();
            if (nshop === undefined && shopFrozenTimer.length > 0)
            {
                nshop = convertTimeToInt(shopFrozenTimer);
            }
            let shopTimer=60;
            if(nshop !== undefined && nshop !== 0)
            {
                // if (Number(nshop)+1 > 2*60*60)
                // {
                //     shopTimer=2*60*60;
                // }
                // else
                // {
                    shopTimer=Number(nshop)+1;
                // }
            }
            setTimer('nextShopTime',shopTimer + randomInterval(60,180));
            if (isJSON(getStoredValue(HHStoredVarPrefixKey+TK.LastPageCalled))
                && getPage() === getStoredJSON(HHStoredVarPrefixKey+TK.LastPageCalled, {page:''}).page)
            {
                gotoPage(ConfigHelper.getHHScriptVars("pagesIDHome"));
                logHHAuto("Go to Home after Shopping");
            }
        }
        return false;
    }

    static moduleShopActions()
    {
        const itemsQuery = '#player-inventory.armor .slot:not(.empty):not([menuSellLocked]):not(.mythic)';
        appendMenuSell();
    
        /**
         * @return "potion" / "gift" / player-stats / armor / booster / null
         */
        function getShopType()
        {
            const shopSelected = $('section #shops #tabs-switcher .market-menu-switch-tab.active');
            if (shopSelected.length > 0)
            {
                return shopSelected.attr("type");
            }
            else
            {
                return null;
            }
        }
    
        function menuSellListItems()
        {
            if ($('#menuSellList>.tItems').length === 0)
            {
                GM_addStyle('.tItems {border-collapse: collapse;} '
                            +'.tItems td,th {border: 1px solid #1B4F72;} '
                            +'.tItemsColGroup {border: 3px solid #1B4F72;} '
                            +'.tItemsTh1 {background-color: #2874A6;color: #fff;} '
                            +'.tItemsTh2 {background-color: #3498DB;color: #fff;} '
                            +'.tItemsTBody tr:nth-child(odd) {background-color: #85C1E9;} '
                            +'.tItemsTBody tr:nth-child(even) {background-color: #D6EAF8;} '
                            +'.tItemsTdItems[itemsLockStatus="allLocked"] {color: #FF0000} '
                            +'.tItemsTdItems[itemsLockStatus="noneLocked"] {color: #1B4F72}'
                            +'.tItemsTdItems[itemsLockStatus="someLocked"] {color: #FFA500}');
            }
    
            let itemsCaracsNb=16;
            let itemsCaracs:(number | string)[]=[];
            for (let i=1;i<itemsCaracsNb+1;i++)
            {
                itemsCaracs.push(i);
            }
            itemsCaracs.push('mythic'); // Needed for mythic equipement, can't use generic method for them
    
            let itemsRarity=["common", "rare", "epic", "legendary", "mythic"];
            let itemsLockedStatus=["not_locked","locked"];
    
            let itemsTypeNb=6;
            let itemsType:number[]=[];
            for (let i=1;i<itemsTypeNb+1;i++)
            {
                itemsType.push(i);
            }
    
            let itemsList={};
            for (let c of itemsCaracs)
            {
                let filteredCarac;
                if(c === 'mythic') {
                    filteredCarac = $('#player-inventory.armor .slot:not(.empty)[data-d*=\'"rarity":"mythic"\']');
                } else {
                    filteredCarac = $('#player-inventory.armor .slot:not(.empty)[data-d*=\'"name_add":'+c+'\']');
                }
    
                itemsList[c] = {};
                for (let t of itemsType)
                {
                    let filteredType = filteredCarac.filter('[data-d*=\'"subtype":'+t+'\']');
                    itemsList[c][t] = {};
                    for (let r of itemsRarity)
                    {
                        let filteredRarity = filteredType.filter('[data-d*=\'"rarity":"'+r+'"\']');
                        itemsList[c][t][r] = {};
                        for (let l of itemsLockedStatus)
                        {
                            let filteredStatus = filteredRarity.filter(l==="locked"?'[menuSellLocked]':':not([menuSellLocked])');
                            itemsList[c][t][r][l]=filteredStatus.length;
                        }
                    }
                }
            }
    
            let itemsListMenu = '<table class="tItems">'
            +' <colgroup class="tItemsColGroup">'
            +'  <col class="tItemsColRarity">'
            +' </colgroup>'
            +' <colgroup class="tItemsColGroup">'
            +'  <col class="tItemsColRarity" span="6">'
            +' </colgroup>'
            +' <colgroup class="tItemsColGroup">'
            +'  <col class="tItemsColRarity" span="6">'
            +' </colgroup>'
            +' <colgroup class="tItemsColGroup">'
            +'  <col class="tItemsColRarity" span="6">'
            +' </colgroup>'
            +' <colgroup class="tItemsColGroup">'
            +'  <col class="tItemsColRarity" span="6">'
            +' </colgroup>'
            +' <colgroup class="tItemsColGroup">'
            +'  <col class="tItemsColRarity" span="6">'
            +' </colgroup>'
            +' <thead class="tItemsTHead">'
            +'  <tr>'
            +'   <th class="tItemsTh1">'+getTextForUI("Rarity","elementText")+'</th>'
            +'   <th class="tItemsTh1" menuSellFilter="c:*;t:*;r:'+itemsRarity[0]+'" colspan="6">'+getTextForUI("RarityCommon","elementText")+'</th>'
            +'   <th class="tItemsTh1" menuSellFilter="c:*;t:*;r:'+itemsRarity[1]+'" colspan="6">'+getTextForUI("RarityRare","elementText")+'</th>'
            +'   <th class="tItemsTh1" menuSellFilter="c:*;t:*;r:'+itemsRarity[2]+'" colspan="6">'+getTextForUI("RarityEpic","elementText")+'</th>'
            +'   <th class="tItemsTh1" menuSellFilter="c:*;t:*;r:'+itemsRarity[3]+'" colspan="6">'+getTextForUI("RarityLegendary","elementText")+'</th>'
            +'   <th class="tItemsTh1" menuSellFilter="c:*;t:*;r:'+itemsRarity[4]+'" colspan="6">'+getTextForUI("RarityMythic","elementText")+'</th>'
            +'  </tr>'
            +'  <tr>'
            +'   <th class="tItemsTh2">'+getTextForUI("equipementCaracs","elementText")+'/'+getTextForUI("equipementType","elementText")+'</th>';
    
            for (let r of itemsRarity)
            {
                itemsListMenu+='   <th class="tItemsTh2" menuSellFilter="c:*;t:'+itemsType[0]+';r:'+r+'">'+getTextForUI("equipementHead","elementText")+'</th>'
                    +'   <th class="tItemsTh2" menuSellFilter="c:*;t:'+itemsType[1]+';r:'+r+'">'+getTextForUI("equipementBody","elementText")+'</th>'
                    +'   <th class="tItemsTh2" menuSellFilter="c:*;t:'+itemsType[2]+';r:'+r+'">'+getTextForUI("equipementLegs","elementText")+'</th>'
                    +'   <th class="tItemsTh2" menuSellFilter="c:*;t:'+itemsType[3]+';r:'+r+'">'+getTextForUI("equipementFlag","elementText")+'</th>'
                    +'   <th class="tItemsTh2" menuSellFilter="c:*;t:'+itemsType[4]+';r:'+r+'">'+getTextForUI("equipementPet","elementText")+'</th>'
                    +'   <th class="tItemsTh2" menuSellFilter="c:*;t:'+itemsType[5]+';r:'+r+'">'+getTextForUI("equipementWeapon","elementText")+'</th>';
            }
    
            itemsListMenu+='  </tr>'
                +' </thead>'
                +' <tbody class="tItemsTBody">';
    
            for (let c of itemsCaracs)
            {
                if(c === 'mythic') {
                    itemsListMenu +='  <tr>'
                        +'   <td class="type" menuSellFilter="c:'+c+';t:*;r:*">'+getTextForUI("RarityMythic","elementText")+'</td>';
                } else {
                    let ext= (c === 16)?"svg":"png";
                    itemsListMenu +='  <tr>'
                        +'   <td class="type" menuSellFilter="c:'+c+';t:*;r:*"><img style="height:20px;width:20px" src="'+ConfigHelper.getHHScriptVars("baseImgPath")+'/pictures/misc/items_icons/'+c+'.'+ext+'"></td>';
                }
    
                for (let r of itemsRarity)
                {
                    for (let t of itemsType)
                    {
                        let allItems = itemsList[c][t][r];
                        let total = allItems[itemsLockedStatus[0]]+allItems[itemsLockedStatus[1]];
                        let displayNb = allItems[itemsLockedStatus[0]]+'/'+total;
                        let itemsLockStatus;
                        if (total === 0)
                        {
                            displayNb = "";
                        }
                        if (allItems[itemsLockedStatus[1]] === 0)
                        {
                            //no lock
                            itemsLockStatus="noneLocked";
                        }
                        else if (allItems[itemsLockedStatus[1]] === total)
                        {
                            //all locked
                            itemsLockStatus="allLocked";
                        }
                        else
                        {
                            //some locked
                            itemsLockStatus="someLocked";
                        }
    
                        itemsListMenu +='   <td class="tItemsTdItems" itemsLockStatus="'+itemsLockStatus+'" menuSellFilter="c:'+c+';t:'+t+';r:'+r+'"'+'>'+displayNb+'</td>';
                    }
                }
    
                itemsListMenu +='  </tr>';
            }
    
    
    
            itemsListMenu +=' </tbody>'
                +'</table>';
            $("#menuSellList").html(itemsListMenu);
    
            function setSlotFilter(inCaracsValue,inTypeValue,inRarityValue,inLockedValue)
            {
                let filter='#player-inventory.armor .slot:not(.empty)';
                if (inCaracsValue !== "*" )
                {
                    filter+='[data-d*=\'"name_add":"'+inCaracsValue+'"\']';
                }
                if (inTypeValue !== "*" )
                {
                    filter+='[data-d*=\'"subtype":"'+inTypeValue+'"\']';
                }
                if (inRarityValue !== "*" )
                {
                    filter+='[data-d*=\'"rarity":"'+inRarityValue+'"\']';
                }
                if (inLockedValue === "locked" || inLockedValue === true)
                {
                    filter+='[menuSellLocked]';
                }
                else
                {
                    filter+=':not([menuSellLocked])';
                }
                return filter;
            }
    
            function setCellsFilter(inCaracsValue,inTypeValue,inRarityValue)
            {
                let filter='table.tItems [menuSellFilter*="';
                if (inCaracsValue !== "*" )
                {
                    filter+='c:'+inCaracsValue+';';
                }
                if (inTypeValue !== "*" )
                {
                    filter+='t:'+inTypeValue+';';
                }
                if (inRarityValue !== "*" )
                {
                    filter+='r:'+inRarityValue;
                }
                filter+='"]';
                return filter;
            }
    
            $('table.tItems [menuSellFilter] ').each(function(){
                this.addEventListener("click", function(){
                    const menuSellFilter = (this.getAttribute("menuSellFilter") || '').split(";");
                    let toLock = !(this.getAttribute("itemsLockStatus") === "allLocked");
                    let c=menuSellFilter[0].split(":")[1];
                    let t=menuSellFilter[1].split(":")[1];
                    let r=menuSellFilter[2].split(":")[1];
                    AllLockUnlock(setSlotFilter(c,t,r,!toLock),toLock);
                    let newLockStatus = toLock?"allLocked":"noneLocked";
                    $(setCellsFilter(c,t,r)).each(function(){
                        this.setAttribute("itemsLockStatus",newLockStatus);
                    });
                });
            });
        }
    
        function AllLockUnlock(inFilter,lock)
        {
            if (lock)
            {
                $(inFilter).each(function(){
                    this.setAttribute("menuSellLocked", "");
                    $(this).prepend('<img class="menuSellLocked" style="position:absolute;width:32px;height:32px" src="https://i.postimg.cc/PxgxrBVB/Opponent-red.png">');
                });
            }
            else
            {
                $(inFilter).each(function(){
                    this.removeAttribute("menuSellLocked");
                    this.querySelector("img.menuSellLocked").remove();
                });
            }
        }
    
        function lockUnlock(inFilter)
        {
            if ($(inFilter).length >0)
            {
                let currentLock = $(inFilter)[0].getAttribute("menuSellLocked");
                if (currentLock === null )
                {
                    $(inFilter)[0].setAttribute("menuSellLocked", "");
                    $(inFilter).prepend('<img class="menuSellLocked" style="position:absolute;width:32px;height:32px" src="https://i.postimg.cc/PxgxrBVB/Opponent-red.png">');
                }
                else
                {
                    $(inFilter)[0].removeAttribute("menuSellLocked");
                    $(inFilter+" img.menuSellLocked")[0].remove();
                }
            }
        }
    
        let menuSellStop = false;
        var allLoaded = false;
        var menuSellMaxItems:string | number = "all";
        let fetchStarted = false;
        //ugly hack
        let loadingAnimationStart = unsafeWindow.shared?.animations?.loadingAnimation?.start;
        let loadingAnimationStop = unsafeWindow.shared?.animations?.loadingAnimation?.stop;
        function appendMenuSell()
        {
            let menuID = "SellDialog"
            if (getShopType() !== "armor")
            {
                if (document.getElementById(menuID) !== null)
                {
                    try
                    {
                        $(document).off('ajaxComplete',checkAjaxComplete);
                        for (let menu of ["menuSell", "menuSellLock", "menuSellMaskLocked"])
                        {
                            const GMMenuID = GM_registerMenuCommand(getTextForUI(menu,"elementText"), function(){});
                            $("#"+menu).remove();
                            GM_unregisterMenuCommand(GMMenuID);
                        }
                        $("#"+menuID).remove();
                    }
                    catch(e)
                    {
                        logHHAuto("Catched error : Couldn't remove "+menuID+" menu : "+e);
                    }
                }
                return;
            }
            else if (document.getElementById(menuID) !== null)
            {
                (<HTMLElement>document.getElementById("menuSellCurrentCount")).innerHTML = $(itemsQuery).length+'';
                return;
            }
    
            GM_addStyle(
                '#SellDialog .close {   position: absolute;   top: 0;   right: 30px;   transition: all 200ms;   font-size: 50px;   font-weight: bold;   text-decoration: none;   color: #333; } '
            + '#SellDialog .close:hover {   color: #06D85F; }'
            + '#SellDialog p { font-size: 15px; }'
            + '#SellDialog p.intro { margin: 0; }'
            + '#SellDialog .myButton { font-size: 12px; min-width: 100px; text-align: center; }'
            + '#SellDialog td.type { text-align: center; }'
            );
    
            var menuSellLock = '<div style="position: absolute;right: 220px;top: 70px" class="tooltipHH"><span class="tooltipHHtext">'+getTextForUI("menuSellLock","tooltip")+'</span><label style="width:70px" class="myButton" id="menuSellLock">'+getTextForUI("menuSellLock","elementText")+'</label></div>'
            var menuSellMaskLocked = '<div style="position: absolute;right: 140px;top: 70px" class="tooltipHH"><span class="tooltipHHtext">'+getTextForUI("menuSellMaskLocked","tooltip")+'</span><label style="width:70px" class="myButton" id="menuSellMaskLocked">'+getTextForUI("menuSellMaskLocked","elementText")+'</label></div>'
            var menuSell = '<div style="position: absolute;right: 300px;top: 70px" class="tooltipHH"><span class="tooltipHHtext">'+getTextForUI("menuSell","tooltip")+'</span><label style="width:70px" class="myButton" id="menuSell">'+getTextForUI("menuSell","elementText")+'</label></div>'
            + '<dialog style="overflow-y:auto;max-width:95%;max-height:95%;"id="SellDialog"><a class="close" id="SellDialogClose">&times;</a><form stylemethod="dialog">'
            +  '<div style="padding:0 10px; display:flex;flex-direction:column;">'
            +   '<p class="intro">'+getTextForUI("menuSellText","elementText")+'</p>'
            +   '<div class="HHMenuRow">'
            +    '<p>'+getTextForUI("menuSellCurrentCount","elementText")+'</p>'
            +    '<p id="menuSellCurrentCount">0</p>'
            +   '</div>'
            + '<div id="menuSellStop"><label style="width:80px" class="myButton" id="menuSellStop">'+getTextForUI("OptionStop","elementText")+'</label></div>'
            +   '<div id="menuSellHide" style="display:none">'
            +    '<p id="menuSellList" style="margin:0;"></p>'
            +    '<div class="HHMenuRow">'
            +     '<div style="padding:10px;" class="tooltipHH"><span class="tooltipHHtext">'+getTextForUI("menuSellButton","tooltip")+'</span><label class="myButton" id="menuSellButton">'+getTextForUI("menuSellButton","elementText")+'</label></div>'
            +     '<div style="padding:10px;" class="tooltipHH"><span class="tooltipHHtext">'+getTextForUI("menuSellNumber","tooltip")+'</span><input id="menuSellNumber" style="width:80%;height:20px" required pattern="'+HHAuto_inputPattern.menuSellNumber+'" type="text" value="0"></div>'
            +    '</div>'
            +   '</div>'
            +   '<div id="menuSoldHide" style="display:none">'
            +    '<div class="HHMenuRow">'
            +     '<p>'+getTextForUI("menuSoldText","elementText")+'</p>'
            +     '<p id="menuSoldCurrentCount">0</p>'
            +    '</div>'
            +    '<p id="menuSoldMessage">0</p>'
            +   '</div>'
            +  '</div>'
            + '<menu> <label style="margin-left:800px" class="myButton" id="menuSellCancel">'+getTextForUI("OptionCancel","elementText")+'</label></menu></form></dialog>'
    
            initMenuSell();
            initMenuSellLock();
            initMenuSellMaskLocked();
            GM_registerMenuCommand(getTextForUI("menuSell","elementText"), displayMenuSell);
            GM_registerMenuCommand(getTextForUI("menuSellLock","elementText"), launchMenuSellLock);
            GM_registerMenuCommand(getTextForUI("menuSellMaskLocked","elementText"), launchMenuSellMaskLocked);
            $(document).on('ajaxComplete',checkAjaxComplete);
    
            function initMenuSell()
            {
                $('#player-inventory.armor').append(menuSell);
    
                const closeSellDialog = function(){
                    const SellDialog = <HTMLDialogElement>document.getElementById("SellDialog");
                    if (typeof SellDialog.showModal !== "function")
                    {
                        alert("The <dialog> API is not supported by this browser");
                        return;
                    }
                    $('#player-inventory.armor .slot:not(.empty)[canBeSold]').removeAttr('canBeSold');
                    SellDialog.close();
                }
    
                $("#menuSell").on("click", displayMenuSell);
                $("#menuSellCancel").on("click", closeSellDialog);
                $("#SellDialogClose").on("click", closeSellDialog);
                $("#menuSellStop").on("click", function(){
                    this.style.display = "none";
                    menuSellStop = true;
                });
    
                $("#menuSellButton").on("click", function(){
                    if (Number((<HTMLInputElement>document.getElementById("menuSellNumber")).value) > 0)
                    {
                        logHHAuto("Starting selling "+Number((<HTMLInputElement>document.getElementById("menuSellNumber")).value)+" items.");
                        sellArmorItems();
                    }
                });
            }
            function displayMenuSell()
            {
                const SellDialog = <HTMLDialogElement>document.getElementById("SellDialog");
                if (typeof SellDialog.showModal !== "function")
                {
                    alert("The <dialog> API is not supported by this browser");
                    logHHAuto("The <dialog> API is not supported by this browser");
                    return;
                }
                menuSellMaxItems = Number(window.prompt("Max amount of inventory to load (all for no limit)",menuSellMaxItems+''));
                if (menuSellMaxItems !== null)
                {
                    menuSellMaxItems = isNaN(menuSellMaxItems)?Number.MAX_VALUE:menuSellMaxItems;
                    logHHAuto(`Going to load ${menuSellMaxItems} items`);
                    $("menuSellStop").css("display","block");

                    menuSellStop = false;
                    fetchStarted = true;
                    unsafeWindow.shared.animations.loadingAnimation.start = function () { };
                    unsafeWindow.shared.animations.loadingAnimation.stop = function () { };
                    if ($('#menuSellList>.tItems').length === 0)
                    {
                        menuSellListItems();
                    }
                    $("#menuSellHide").css("display","block");
                    SellDialog.showModal();
                    $("#menuSellHide").css("display","none");
                    fetchAllArmorItems();
                }
            }
    
            function initMenuSellMaskLocked()
            {
                $('#player-inventory.armor').append(menuSellMaskLocked);
                $("#menuSellMaskLocked").on("click", launchMenuSellMaskLocked);
            }
            function launchMenuSellMaskLocked()
            {
                $("#player-inventory.armor .slot[menuSellLocked]").each(function(){
                    $(this).parent().toggle();
                });
            }
    
            function initMenuSellLock()
            {
                $('#player-inventory.armor').append(menuSellLock);
                $("#menuSellLock").on("click", launchMenuSellLock);
            }
            function launchMenuSellLock()
            {
                let filterText = "#player-inventory.armor .slot.selected";
                if ($(filterText).length >0)
                {
                    let toLock=$(filterText)[0].getAttribute("menuSellLocked") === null;
                    AllLockUnlock(filterText,toLock);
                }
            }
        }
    
        function checkAjaxComplete(event,request,settings){
            let match = settings.data.match(/action=market_get_armor&id_member_armor=(\d+)/);
            if (match === null) return;
            allLoaded = request.responseJSON.items.length === 0 && request.responseJSON.success; // No more to load
            if (fetchStarted)
            {
                setTimeout(fetchAllArmorItems, randomInterval(800,1600));
            }
        }
    
        function fetchAllArmorItems()
        {
            let oldCount = $(itemsQuery).length;
            $("#menuSellCurrentCount").html(oldCount +'');
            if (allLoaded) {
                logHHAuto(`No more items to load, currently: ${oldCount}/${menuSellMaxItems}`);
            }else{
                logHHAuto(`Loading items, currently: ${oldCount}/${menuSellMaxItems}`);
            }
            let scroll = $("#player-inventory.armor")[0];
            const SellDialog = <HTMLDialogElement>document.getElementById("SellDialog");
            if (menuSellStop || allLoaded || oldCount >= Number(menuSellMaxItems) || !SellDialog.open)
            {
                $("#menuSellStop").css("display","none");
                unsafeWindow.shared.animations.loadingAnimation.start = loadingAnimationStart;
                unsafeWindow.shared.animations.loadingAnimation.stop = loadingAnimationStop;
                fetchStarted = false;
                scroll.scrollTop = 0;
                if (SellDialog.open)
                {
                    $("#menuSellHide").css("display","block");
                    menuSellListItems();
                }
                else
                {
                    logHHAuto('Sell Dialog closed, stopping');
                }
                return;
            }
            scroll.scrollTop = scroll.scrollHeight-scroll.offsetHeight;
        }

        function sellArmorEnded() {
            $("#menuSellHide").css("display","block");
            setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "true");
            setTimeout(autoLoop, Number(getStoredValue(HHStoredVarPrefixKey+TK.autoLoopTimeMili)));
        }
    
        function sellArmorItems()
        {
            setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");
            logHHAuto("setting autoloop to false");

            logHHAuto('start selling common, rare and epic stuff');
            $("#menuSellHide").css("display","none");
            $("#menuSoldHide").css("display","block");

            // Scroll to top
            $('#player-inventory').animate({scrollTop: 0});
            var initialNumberOfItems = $(itemsQuery).length;
            var itemsToSell = Number((<HTMLInputElement>(<HTMLInputElement>document.getElementById("menuSellNumber"))).value);
            $("#menuSoldCurrentCount").html("0/"+itemsToSell);
            $("#menuSoldMessage").html("");
            let PlayerClass = HeroHelper.getClass() === null ? $('#equiped > div.icon.class_change_btn').attr('carac') : HeroHelper.getClass();
            function sellingEnd(message:string){
                $("#menuSoldMessage").html(message);
                menuSellListItems();
                sellArmorEnded();
            }
            function selling_func()
            {
                const SellDialog = <HTMLDialogElement>document.getElementById("SellDialog");
                if ($('#player-inventory.armor').length === 0)
                {
                    logHHAuto('Wrong tab');
                    sellArmorEnded();
                    return;
                }
                else if (!SellDialog.open)
                {
                    logHHAuto('Sell Dialog closed, stopping');
                    sellArmorEnded();
                    return;
                }
                let availebleItems = $(itemsQuery);
                let currentNumberOfItems = availebleItems.length;
                if (currentNumberOfItems === 0)
                {
                    logHHAuto('no more items for sale');
                    sellingEnd(getTextForUI("menuSoldMessageNoMore","elementText"));
                    return;
                }
                if (initialNumberOfItems < currentNumberOfItems) {
                    logHHAuto('Some items was loaded in the background, can\'t continue');
                    sellingEnd(getTextForUI("menuSoldMessageErrorLoaded","elementText"));
                    return;
                }
                //console.log(initialNumberOfItems,currentNumberOfItems);
                if ((initialNumberOfItems - currentNumberOfItems) >= itemsToSell) {
                    logHHAuto('Reach wanted sold items.');
                    sellingEnd(getTextForUI("menuSoldMessageReachNB","elementText"));
                    return;
                }
                //check Selected item - can we sell it?
                if (availebleItems.filter('.selected').length > 0)
                {
                    let can_sell = false;
                    //Non legendary or with specific attribute
                    if (availebleItems.filter('.selected').filter(':not(.legendary),[canBeSold]').length > 0)
                    {
                        can_sell = true;
                    }
                    logHHAuto('can be sold ' + can_sell+ ' : '+ availebleItems.filter('.selected')[0].getAttribute('data-d'));
                    if (can_sell)
                    {
                        $('#shops .menu-switch-tab-content.active button.green_text_button[rel=sell]').click();
                        let currSellNumber = Number((initialNumberOfItems - currentNumberOfItems) +1);
                        $("#menuSoldCurrentCount").html( currSellNumber+"/"+itemsToSell );
                        $("#menuSellCurrentCount").html($(itemsQuery).length+'');
                        setTimeout(selling_func, randomInterval(300,700));
                        return;
                    }
                }
                //Find new sellable items
                if (availebleItems.filter(':not(.selected):not(.legendary),[canBeSold]').length > 0)
                {
                    //Select first non legendary item
                    //Or select item that checked before and can be sold
                    availebleItems.filter(':not(.selected):not(.legendary):not(.mythic),[canBeSold]')[0].click();
                    setTimeout(selling_func, randomInterval(300,700));
                    return;
                }
                else if (availebleItems.filter(':not(.selected)').length > 0)
                {
                    let typesOfSets = ['EQ-LE-06','EQ-LE-05','EQ-LE-04','EQ-LE-0' + PlayerClass];
                    let caracsOfSets = ['carac' + PlayerClass,'chance','endurance','carac' + PlayerClass];
                    //[MaxCarac,Index]
                    let arraysOfSets = [
                        [[-1, -1], [-1, -1], [-1, -1], [-1, -1], [-1, -1], [-1, -1], [-1, -1]],//'EQ-LE-06'
                        [[-1, -1], [-1, -1], [-1, -1], [-1, -1], [-1, -1], [-1, -1], [-1, -1]],//'EQ-LE-05'
                        [[-1, -1], [-1, -1], [-1, -1], [-1, -1], [-1, -1], [-1, -1], [-1, -1]],//'EQ-LE-04'
                        [[-1, -1], [-1, -1], [-1, -1], [-1, -1], [-1, -1], [-1, -1], [-1, -1]]//'EQ-LE-0'+ PlayerClass
                    ];
                    /*//Take equipped items into account
                    for (let indexType = 0; indexType < typesOfSets.length; indexType++)
                    {
                        let equipedArray = $('#equiped .armor .slot[data-d*=' + typesOfSets[indexType] + ']');
                        for (let i5 = 0; i5 < equipedArray.length; i5++) {
                            let equipedObj = JSON.parse($(equipedArray[i5]).attr('data-d'));
                            arraysOfSets[indexType][equipedObj.subtype][0] = equipedObj[caracsOfSets[indexType]];
                        }
                    }*/
    
                    for (let i4 = 0; i4 < availebleItems.length; i4++)
                    {
                        let sellableItemObj = JSON.parse($(availebleItems[i4]).attr('data-d') || '');
                        let indexType = typesOfSets.indexOf(sellableItemObj.id_equip);
    
                        if (indexType == -1)
                        {
                            //console.log('can_sell2');
                            availebleItems[i4].setAttribute('canBeSold', '');
                        }
                        else
                        {
                            let currentBest = arraysOfSets[indexType][sellableItemObj.subtype];
                            let itemCarac = sellableItemObj[caracsOfSets[indexType]];
                            //checking best gear in inventory based on best class stat
                            if (currentBest[0] < itemCarac)
                            {
                                currentBest[0] = itemCarac;
                                if (currentBest[1] >= 0)
                                {
                                    availebleItems[currentBest[1]].setAttribute('canBeSold', '');
                                }
                                currentBest[1] = i4;
                            }
                            else
                            {
                                availebleItems[i4].setAttribute('canBeSold', '');
                            }
                        }
                    }
                    if ($('#player-inventory.armor [canBeSold]:not([menuSellLocked]):not(.mythic)').length == 0)
                    {
                        logHHAuto('no more items for sale');
                        sellingEnd(getTextForUI("menuSoldMessageReachNB","elementText"));
                        return;
                    }
                }
    
                setTimeout(selling_func, randomInterval(300,700));
            }
            selling_func();
        }
    }
    
}