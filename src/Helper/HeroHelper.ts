// HeroHelper.ts
//
// Provides read access to the player's hero data (class, level, money,
// kobans) and actions that modify the hero: stat upgrades and booster
// equipping. Hero data lives on the game's global `window.Hero` (or
// `window.shared.Hero` on newer builds), accessed via unsafeWindow.
//
// Why stat upgrade logic lives here: Upgrading stats is a sequential,
// recursive process (buy one increment, wait, repeat) that only touches
// hero data. Keeping it next to the accessors avoids circular deps
// with the Module layer.
//
// Used by: AutoLoop (stat upgrades on burst), Booster module (equip),
//          BDSM simulator (hero stats for fight prediction)

import { addNutakuSession, autoLoop } from '../Service/index';
import { getHHAjax, isJSON, logHHAuto } from '../Utils/index';
import { HHStoredVarPrefixKey, SK, TK } from '../config/index';
import { KKHero } from '../model/index';
import { ConfigHelper } from './ConfigHelper';
import { getHHVars } from "./HHHelper";
import { deleteStoredValue, getStoredJSON, getStoredValue, setStoredValue } from "./StorageHelper";
import { randomInterval } from "./TimeHelper";

export function getHero():KKHero
{
    if(unsafeWindow.shared?.Hero === undefined)
    {
        setTimeout(autoLoop, Number(getStoredValue(HHStoredVarPrefixKey+TK.autoLoopTimeMili)) || 1000);
        //logHHAuto(window.wrappedJSObject)
    }
    return unsafeWindow.shared?.Hero;
}

export function doStatUpgrades()
{
    //Stats?
    //logHHAuto('stats');
    var Hero=getHero();
    var stats=[getHHVars('Hero.infos.carac1'),getHHVars('Hero.infos.carac2'),getHHVars('Hero.infos.carac3')];
    var money = HeroHelper.getMoney();
    var count=0;
    var M=Number(getStoredValue(HHStoredVarPrefixKey+SK.autoStats));
    var MainStat = stats[HeroHelper.getClass() -1];
    var Limit = HeroHelper.getLevel() * 30;//HeroHelper.getLevel()*19+Math.min(HeroHelper.getLevel(),25)*21;
    var carac = HeroHelper.getClass();
    var mp=0;
    var mults=[60,30,10,1];
    for (var car=0; car<3; car++)
    {
        //logHHAuto('stat '+carac);
        var s=stats[carac-1];
        for (var mu=0;mu<5;mu++)
        {
            var mult=mults[mu];
            var price = 5+s*2+(Math.max(0,s-2000)*2)+(Math.max(0,s-4000)*2)+(Math.max(0,s-6000)*2)+(Math.max(0,s-8000)*2);
            price*=mult;
            if (carac == HeroHelper.getClass())
            {
                mp=price;
            }
            //logHHAuto('money: '+money+' stat'+carac+': '+stats[carac-1]+' price: '+price);
            if ((stats[carac-1]+mult)<=Limit && (money-price)>M && (carac==HeroHelper.getClass() || price<mp/2 || (MainStat+mult)>Limit))
            {
                count++;
                logHHAuto('money: '+money+' stat'+carac+': '+stats[carac-1]+' [+'+mult+'] price: '+price);
                money-=price;
                var params = {
                    carac: "carac" + carac,
                    action: "hero_update_stats",
                    nb: mult
                };
                getHHAjax()(params, function(data) {
                    Hero.update("soft_currency", 0 - price, true);
                });
                setTimeout(doStatUpgrades, randomInterval(300,500));
                return;
                break;
            }
        }
        carac=(carac+1)%3+1;
    }
}

export class HeroHelper {

    static getPlayerId():number {
        return getHHVars('Hero.infos.id');
    }

    static getClass():number {
        return getHHVars('Hero.infos.class');
    }

    static getLevel():number {
        return getHHVars('Hero.infos.level');
    }

    static getMoney():number {
        return getHHVars('Hero.currencies.soft_currency');
    }

    static getKoban():number {
        return getHHVars('Hero.currencies.hard_currency');
    }

    static haveBoosterInInventory(idBooster:string) {
        const HaveBooster=getStoredJSON(HHStoredVarPrefixKey+TK.haveBooster, {});
        const boosterOwned = HaveBooster.hasOwnProperty(idBooster) ? Number(HaveBooster[idBooster]) : 0;
        return boosterOwned > 0
    }

    static async equipBooster(booster:any):Promise<boolean> {
        if(!booster) return Promise.resolve(false);
        if(!HeroHelper.haveBoosterInInventory(booster.identifier)) {
            logHHAuto("Booster " + booster + " not in inventory");
            return Promise.resolve(false);
        }
        let itemId = ConfigHelper.getHHScriptVars("boosterId_" + booster.identifier, false);
        if (!itemId) {
            itemId = booster.id_item;
        }
        //action=market_equip_booster&id_item=316&type=booster
        setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "false");
        logHHAuto("equipBooster: Equip "+booster.name+" (id_item="+itemId+"), setting autoloop to false");
        const params = {
            action: "market_equip_booster",
            id_item: itemId,
            type: "booster"
        };

        return new Promise((resolve) => {
            // change referer
            const currentPath = window.location.href.replace('http://', '').replace('https://', '').replace(window.location.hostname, '');
            window.history.replaceState(null, '', addNutakuSession('/shop.html') as string);

            // Guard: ensure we resolve exactly once, even if both AJAX callback and timeout fire.
            let settled = false;
            let timeoutId: ReturnType<typeof setTimeout> | null = null;
            const settle = (value: boolean) => {
                if (settled) return;
                settled = true;
                if (timeoutId !== null) clearTimeout(timeoutId);
                setStoredValue(HHStoredVarPrefixKey+TK.autoLoop, "true");
                setTimeout(autoLoop,randomInterval(500,800));
                resolve(value);
            };

            // Option C: Safety timeout in case the AJAX call never invokes either callback
            // (seen in the wild when the referer swap collides with navigation). Without
            // this, the promise would hang forever and the autoLoop stays paused.
            timeoutId = setTimeout(() => {
                if (settled) return;
                logHHAuto('equipBooster: AJAX timeout after 15s — resolving with false and invalidating boosterStatus');
                // Treat a hang as "state unknown": drop the freshness stamp so the next
                // auto-equip cycle re-reads boosterStatus from the market.
                deleteStoredValue(HHStoredVarPrefixKey + TK.boosterStatusLastUpdate);
                HeroHelper.getSandalWoodEquipFailure(true);
                settle(false);
            }, 15000);

            getHHAjax()(params, function(data) {
                logHHAuto(`equipBooster: AJAX success callback, data.success=${data.success}, full response=${JSON.stringify(data)}`);
                if (data.success) {
                    logHHAuto('equipBooster: Booster equipped successfully');
                } else {
                    logHHAuto('equipBooster: Server returned success:false (may already be equipped)');
                    // Option D: a success:false response means our local boosterStatus is
                    // out of sync with the server (another browser/tab probably equipped
                    // boosters while we were paused). Invalidate the freshness timestamp
                    // so autoEquipBoosters refreshes from the market before retrying.
                    deleteStoredValue(HHStoredVarPrefixKey + TK.boosterStatusLastUpdate);
                    HeroHelper.getSandalWoodEquipFailure(true); // Increase failure
                }
                logHHAuto(`equipBooster: resolving with ${data.success}`);
                settle(!!data.success);
            }, function (err){
                logHHAuto('equipBooster: AJAX error callback - ' + err);
                // Network/server error also implies our cached state may be wrong — invalidate.
                deleteStoredValue(HHStoredVarPrefixKey + TK.boosterStatusLastUpdate);
                HeroHelper.getSandalWoodEquipFailure(true); // Increase failure
                logHHAuto('equipBooster: resolving with false');
                settle(false);
            });
            // change referer
            window.history.replaceState(null, '', addNutakuSession(currentPath) as string);
        });

    }

    static getSandalWoodEquipFailure(increase:boolean=false){
        const numberFailureStr:string = getStoredValue(HHStoredVarPrefixKey+TK.sandalwoodFailure) ?? '0';
        let numberFailure = numberFailureStr ? Number(numberFailureStr): 0;
        if(isNaN(numberFailure)) numberFailure = 0;
        if(increase) numberFailure = numberFailure + 1;
        setStoredValue(HHStoredVarPrefixKey+TK.sandalwoodFailure, numberFailure);
        return numberFailure;
    }
}