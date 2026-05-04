// ==UserScript==
// @name         HHAuto Debug - Full Window Dump
// @namespace    HHAuto_Debug
// @version      2.1.0
// @description  Dumps ALL window arrays with girl objects + position mapping via blessed girls
// @match        http*://*.haremheroes.com/*
// @match        http*://*.hentaiheroes.com/*
// @match        http*://*.gayharem.com/*
// @match        http*://*.comixharem.com/*
// @match        http*://*.hornyheroes.com/*
// @match        http*://*.pornstarharem.com/*
// @match        http*://*.transpornstarharem.com/*
// @match        http*://*.gaypornstarharem.com/*
// @match        http*://*.mangarpg.com/*
// @match        http*://*.amouragent.com/*
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

(function() {
    "use strict";

    function isGirlLike(obj) {
        if (!obj || typeof obj !== "object") return false;
        return (obj.id_girl !== undefined) || (obj.carac1 !== undefined) || (obj.name && obj.level !== undefined);
    }

    function dump() {
        const o = [];
        o.push("=== FULL DUMP v2.1 ===");
        o.push("Time: " + new Date().toISOString());
        o.push("URL: " + location.href);
        o.push("Host: " + location.hostname);
        o.push("");

        // PART 1: ALL unsafeWindow keys
        o.push("--- PART 1: ALL unsafeWindow keys ---");
        const allKeys = [];
        try {
            for (const k of Object.keys(unsafeWindow)) {
                try {
                    const v = unsafeWindow[k];
                    let info = typeof v;
                    if (v === null) info = "null";
                    else if (Array.isArray(v)) info = "Array[" + v.length + "]";
                    else if (info === "object") info = "Obj{" + Object.keys(v).length + "}";
                    allKeys.push(k + "=" + info);
                } catch(e) { allKeys.push(k + "=[err]"); }
            }
        } catch(e) { o.push("Error: " + e.message); }
        o.push("Total: " + allKeys.length);
        o.push(allKeys.join("\n"));
        o.push("");

        // PART 2: shared keys
        if (unsafeWindow.shared) {
            o.push("--- PART 2: shared keys ---");
            const sk = [];
            try { for (const k of Object.keys(unsafeWindow.shared)) { try { const v=unsafeWindow.shared[k]; let i=typeof v; if(v===null)i="null"; else if(Array.isArray(v))i="Arr["+v.length+"]"; else if(i==="object")i="Obj{"+Object.keys(v).length+"}"; sk.push(k+"="+i); } catch(e){sk.push(k+"=[err]");} } } catch(e){}
            o.push(sk.join("\n"));
            o.push("");
        } else { o.push("--- PART 2: NO shared ---"); o.push(""); }

        // PART 3: Find girl arrays
        o.push("--- PART 3: Girl arrays ---");
        const girlArrays = [];
        const scanned = new Set();
        function scan(root, path, depth) {
            if (depth > 3 || scanned.has(root)) return;
            scanned.add(root);
            try { for (const k of Object.keys(root)) { try { const v=root[k]; const fp=path+"."+k; if(Array.isArray(v)&&v.length>0&&isGirlLike(v[0])){girlArrays.push({path:fp,length:v.length,arr:v});} else if(v&&typeof v==="object"&&!Array.isArray(v)&&depth<2){scan(v,fp,depth+1);} } catch(e){} } } catch(e){}
        }
        scan(unsafeWindow, "window", 0);
        if (unsafeWindow.shared) scan(unsafeWindow.shared, "shared", 0);

        if (girlArrays.length === 0) {
            o.push("NO girl arrays found! Open Change Team panel first.");
            o.push("");
        } else {
            for (const ga of girlArrays) o.push("FOUND: " + ga.path + " (" + ga.length + " items)");
            o.push("");
        }

        // Use largest girl array
        const best = girlArrays.sort((a,b) => b.length - a.length)[0];
        if (!best) { show(o.join("\n")); return; }
        const arr = best.arr;

        o.push("Using: " + best.path + " (" + arr.length + " girls)");
        o.push("Fields: " + JSON.stringify(Object.keys(arr[0]).sort()));
        o.push("");

        // PART 4: Unique trait values
        o.push("--- PART 4: Unique trait values ---");
        const maps = {};
        for (const g of arr) {
            for (const k of Object.keys(g)) {
                const lk = k.toLowerCase();
                if (lk.includes("color") || lk.includes("zodiac") || lk.includes("position_img") || k === "rarity" || k === "element") {
                    if (!maps[k]) maps[k] = {};
                    const val = (typeof g[k] === "object") ? JSON.stringify(g[k]) : String(g[k] === undefined || g[k] === null || g[k] === "" ? "EMPTY" : g[k]);
                    maps[k][val] = (maps[k][val] || 0) + 1;
                }
            }
        }
        for (const [field, valMap] of Object.entries(maps)) {
            const sorted = Object.entries(valMap).sort((a,b) => b[1] - a[1]);
            o.push(field + " (" + sorted.length + " unique):");
            for (const [v, c] of sorted) o.push("  " + v + " = " + c);
            o.push("");
        }

        // PART 5: Position mapping via blessed girls
        o.push("--- PART 5: Position mapping (blessed girls) ---");
        const blessedPos = arr.filter(g => g.blessing_bonuses && g.blessing_bonuses.pvp_v3);
        const blessedEye = arr.filter(g => g.blessing_bonuses && g.blessing_bonuses.pvp_v3);
        o.push("Girls with pvp_v3 (position/eye blessing): " + blessedPos.length);
        if (blessedPos.length > 0) {
            const posCount = {};
            for (const g of blessedPos) { const p = g.position_img || "?"; posCount[p] = (posCount[p]||0)+1; }
            o.push("Their position_img values: " + JSON.stringify(posCount));
            o.push("First 5:");
            for (let i = 0; i < Math.min(5, blessedPos.length); i++) {
                const g = blessedPos[i];
                o.push("  " + g.name + " pos=" + g.position_img + " eye=" + g.eye_color1 + " hair=" + g.hair_color1 + " elem=" + (g.element_data?g.element_data.type:g.element));
            }
        }
        o.push("");

        // Also check pvp_v3 bonus values to distinguish position vs eye blessing
        o.push("--- PART 5b: Blessing bonus breakdown ---");
        const byBonus = {pvp_v3: [], pvp_v4: [], other: []};
        for (const g of arr) {
            if (!g.blessing_bonuses || typeof g.blessing_bonuses !== "object") continue;
            if (Array.isArray(g.blessing_bonuses) && g.blessing_bonuses.length === 0) continue;
            for (const key of Object.keys(g.blessing_bonuses)) {
                if (key === "pvp_v3") byBonus.pvp_v3.push(g);
                else if (key === "pvp_v4") byBonus.pvp_v4.push(g);
                else byBonus.other.push(g);
            }
        }
        o.push("pvp_v3 girls: " + byBonus.pvp_v3.length);
        o.push("pvp_v4 girls: " + byBonus.pvp_v4.length);

        // Group pvp_v3 girls by their bonus percentage to separate position(30%) from eye(40%)
        if (byBonus.pvp_v3.length > 0) {
            const byPct = {};
            for (const g of byBonus.pvp_v3) {
                const pct = g.blessing_bonuses.pvp_v3.carac1 ? g.blessing_bonuses.pvp_v3.carac1[0] : "?";
                if (!byPct[pct]) byPct[pct] = [];
                byPct[pct].push(g);
            }
            for (const [pct, girls] of Object.entries(byPct)) {
                o.push("  +"+pct+"% group (" + girls.length + " girls):");
                const posVals = {}; const eyeVals = {};
                for (const g of girls) {
                    posVals[g.position_img||"?"] = (posVals[g.position_img||"?"]||0)+1;
                    eyeVals[g.eye_color1||"?"] = (eyeVals[g.eye_color1||"?"]||0)+1;
                }
                o.push("    positions: " + JSON.stringify(posVals));
                o.push("    eye_colors: " + JSON.stringify(eyeVals));
                o.push("    examples: " + girls.slice(0,3).map(g => g.name + " pos=" + g.position_img + " eye=" + g.eye_color1).join(", "));
            }
        }
        o.push("");

        // PART 6: One example girl per position_img
        o.push("--- PART 6: Example girl per position ---");
        const posExamples = {};
        for (const g of arr) {
            const p = g.position_img || "?";
            if (!posExamples[p]) posExamples[p] = g.name + " (elem=" + (g.element_data?g.element_data.type:g.element) + ")";
        }
        for (const [p, ex] of Object.entries(posExamples).sort()) o.push("  " + p + " -> " + ex);
        o.push("");

        // PART 7: Blessing cache
        o.push("--- PART 7: Blessing Cache ---");
        try {
            const ck = Object.keys(localStorage).find(k => k.includes("blessingsCache"));
            if (ck) { o.push("Key: " + ck); o.push(localStorage.getItem(ck)); }
            else o.push("Not found");
        } catch(e) { o.push("Error: " + e.message); }
        o.push("");

        // PART 8: Top 15
        o.push("--- PART 8: Top 15 by stats ---");
        const top = [...arr].sort((a,b) => ((b.carac1||0)+(b.carac2||0)+(b.carac3||0)) - ((a.carac1||0)+(a.carac2||0)+(a.carac3||0))).slice(0, 15);
        for (const g of top) {
            const s = (g.carac1||0)+(g.carac2||0)+(g.carac3||0);
            const bl = (g.blessing_bonuses && typeof g.blessing_bonuses === "object" && !Array.isArray(g.blessing_bonuses) && Object.keys(g.blessing_bonuses).length > 0) ? "[B]" : "   ";
            o.push(bl + " " + (g.name||"?") + " s=" + Math.round(s) + " eye=" + g.eye_color1 + " hair=" + g.hair_color1 + " pos=" + g.position_img + " z=" + (g.zodiac||"?").substring(0,5) + " e=" + (g.element_data?g.element_data.type:g.element) + " " + g.rarity + " l=" + g.level + " g=" + g.graded);
        }
        o.push("");

        // PART 9: Full girl[0]
        o.push("--- PART 9: Full girl[0] ---");
        const fg = arr[0]; const rf = {};
        for (const k of Object.keys(fg)) { if(typeof fg[k]==="string"&&fg[k].length>300){rf[k]="[STR:"+fg[k].length+"]";}else{rf[k]=fg[k];} }
        o.push(JSON.stringify(rf, null, 2));

        o.push("");
        o.push("=== END ===");
        show(o.join("\n"));
    }

    function show(text) {
        console.log(text);
        const ov=document.createElement("div");ov.style.cssText="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;";
        const ta=document.createElement("textarea");ta.value=text;ta.style.cssText="width:90%;height:82%;font:11px monospace;padding:10px;border-radius:5px;background:#1a1a1a;color:#0f0;";
        const row=document.createElement("div");row.style.cssText="margin-top:10px;display:flex;gap:10px;";
        const cp=document.createElement("button");cp.textContent="COPY ALL";cp.style.cssText="padding:12px 24px;font-size:16px;cursor:pointer;background:#4CAF50;color:white;border:none;border-radius:4px;font-weight:bold;";cp.onclick=()=>{ta.select();document.execCommand("copy");cp.textContent="COPIED!";};
        const cl=document.createElement("button");cl.textContent="CLOSE";cl.style.cssText="padding:12px 24px;font-size:16px;cursor:pointer;background:#f44336;color:white;border:none;border-radius:4px;font-weight:bold;";cl.onclick=()=>ov.remove();
        row.appendChild(cp);row.appendChild(cl);ov.appendChild(ta);ov.appendChild(row);document.body.appendChild(ov);ta.select();
    }

    setTimeout(()=>{const b=document.createElement("div");b.textContent="\ud83d\udd0d FULL DUMP";b.style.cssText="position:fixed;top:10px;right:10px;z-index:99999;background:#ff4444;color:white;padding:14px 20px;border-radius:5px;cursor:pointer;font-weight:bold;font-size:16px;box-shadow:0 2px 10px rgba(0,0,0,0.5);";b.onclick=dump;document.body.appendChild(b);},3000);
})();
