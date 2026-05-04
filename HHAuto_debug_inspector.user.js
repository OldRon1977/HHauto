// ==UserScript==
// @name         HHAuto Debug - Position Mapping
// @namespace    HHAuto_Debug
// @version      2.2.0
// @description  Finds position_img to name mapping via blessed girls and id_role
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
        return (obj.id_girl !== undefined) || (obj.carac1 !== undefined);
    }

    function findGirls() {
        const scanned = new Set();
        const results = [];
        function scan(root, path, depth) {
            if (depth > 3 || scanned.has(root)) return;
            scanned.add(root);
            try { for (const k of Object.keys(root)) { try { const v=root[k]; if(Array.isArray(v)&&v.length>0&&isGirlLike(v[0])){results.push({path:path+"."+k,arr:v});} else if(v&&typeof v==="object"&&!Array.isArray(v)&&depth<2){scan(v,path+"."+k,depth+1);} } catch(e){} } } catch(e){}
        }
        scan(unsafeWindow, "window", 0);
        if (unsafeWindow.shared) scan(unsafeWindow.shared, "shared", 0);
        return results.sort((a,b) => b.arr.length - a.arr.length)[0] || null;
    }

    function dump() {
        const found = findGirls();
        const o = [];
        o.push("=== POSITION MAPPING DUMP v2.2 ===");
        o.push("Time: " + new Date().toISOString());
        o.push("Host: " + location.hostname);
        o.push("");

        if (!found) { o.push("ERROR: No girl data. Open Change Team panel."); show(o.join("\n")); return; }
        const arr = found.arr;
        o.push("Source: " + found.path + " (" + arr.length + " girls)");
        o.push("");

        // Blessing cache
        o.push("--- Blessing Cache ---");
        try {
            const ck = Object.keys(localStorage).find(k => k.includes("blessingsCache"));
            if (ck) {
                const c = JSON.parse(localStorage.getItem(ck));
                o.push("blessedTraits: " + JSON.stringify(c.blessedTraits));
                o.push("blessedValues: " + JSON.stringify(c.blessedValues));
                if (c.raw && c.raw.active) {
                    for (const b of c.raw.active) o.push("  " + b.title + " | " + b.description.replace(/<[^>]+>/g, ""));
                }
            } else o.push("Not found");
        } catch(e) { o.push("Error: " + e.message); }
        o.push("");

        // Separate blessings by bonus percentage
        o.push("--- Blessing Bonus Groups ---");
        const groups = {};
        for (const g of arr) {
            if (!g.blessing_bonuses || typeof g.blessing_bonuses !== "object" || Array.isArray(g.blessing_bonuses)) continue;
            if (!g.blessing_bonuses.pvp_v3) continue;
            const pcts = g.blessing_bonuses.pvp_v3.carac1;
            if (!Array.isArray(pcts)) continue;
            // Each value in the array is a separate blessing
            for (const pct of pcts) {
                const key = "+" + pct + "%";
                if (!groups[key]) groups[key] = [];
                groups[key].push(g);
            }
        }

        for (const [pct, girls] of Object.entries(groups).sort()) {
            o.push("Group " + pct + " (" + girls.length + " girls):");

            // position_img distribution
            const posCount = {};
            for (const g of girls) posCount[g.position_img || "?"] = (posCount[g.position_img || "?"] || 0) + 1;
            o.push("  position_img: " + JSON.stringify(posCount));

            // eye_color1 distribution
            const eyeCount = {};
            for (const g of girls) eyeCount[g.eye_color1 || "?"] = (eyeCount[g.eye_color1 || "?"] || 0) + 1;
            o.push("  eye_color1: " + JSON.stringify(eyeCount));

            // hair_color1 distribution
            const hairCount = {};
            for (const g of girls) hairCount[g.hair_color1 || "?"] = (hairCount[g.hair_color1 || "?"] || 0) + 1;
            o.push("  hair_color1: " + JSON.stringify(hairCount));

            // id_role distribution
            const roleCount = {};
            for (const g of girls) roleCount[g.id_role || "?"] = (roleCount[g.id_role || "?"] || 0) + 1;
            o.push("  id_role: " + JSON.stringify(roleCount));

            // zodiac distribution (first 5 chars)
            const zodCount = {};
            for (const g of girls) zodCount[(g.zodiac || "?").substring(0, 5)] = (zodCount[(g.zodiac || "?").substring(0, 5)] || 0) + 1;
            o.push("  zodiac: " + JSON.stringify(zodCount));

            o.push("");
        }

        // Now: for the POSITION blessing specifically, find which group has uniform position_img
        o.push("--- Position Blessing Detection ---");
        o.push("Looking for a group where ALL girls share the same position_img...");
        for (const [pct, girls] of Object.entries(groups)) {
            const posCount = {};
            for (const g of girls) posCount[g.position_img || "?"] = (posCount[g.position_img || "?"] || 0) + 1;
            const entries = Object.entries(posCount);
            if (entries.length === 1) {
                o.push("  FOUND! " + pct + " group: ALL " + girls.length + " girls have position_img=" + entries[0][0]);
            }
            // Also check if one position dominates (>90%)
            const total = girls.length;
            for (const [pos, cnt] of entries) {
                if (cnt / total > 0.9 && entries.length > 1) {
                    o.push("  LIKELY: " + pct + " group: " + cnt + "/" + total + " girls have position_img=" + pos);
                }
            }
        }
        o.push("");

        // Same for eye_color
        o.push("--- Eye Color Blessing Detection ---");
        o.push("Looking for a group where ALL girls share the same eye_color1...");
        for (const [pct, girls] of Object.entries(groups)) {
            const eyeCount = {};
            for (const g of girls) eyeCount[g.eye_color1 || "?"] = (eyeCount[g.eye_color1 || "?"] || 0) + 1;
            const entries = Object.entries(eyeCount);
            if (entries.length === 1) {
                o.push("  FOUND! " + pct + " group: ALL " + girls.length + " girls have eye_color1=" + entries[0][0]);
            }
            const total = girls.length;
            for (const [eye, cnt] of entries) {
                if (cnt / total > 0.9 && entries.length > 1) {
                    o.push("  LIKELY: " + pct + " group: " + cnt + "/" + total + " girls have eye_color1=" + eye);
                }
            }
        }
        o.push("");

        // Hair color detection
        o.push("--- Hair Color Blessing Detection ---");
        for (const [pct, girls] of Object.entries(groups)) {
            const hairCount = {};
            for (const g of girls) hairCount[g.hair_color1 || "?"] = (hairCount[g.hair_color1 || "?"] || 0) + 1;
            const entries = Object.entries(hairCount);
            if (entries.length === 1) {
                o.push("  FOUND! " + pct + " group: ALL " + girls.length + " girls have hair_color1=" + entries[0][0]);
            }
        }
        o.push("");

        // Full position_img to id_role cross-reference
        o.push("--- position_img vs id_role cross-reference ---");
        const posRoleMap = {};
        for (const g of arr) {
            const pos = g.position_img || "?";
            const role = g.id_role || "?";
            if (!posRoleMap[pos]) posRoleMap[pos] = {};
            posRoleMap[pos][role] = (posRoleMap[pos][role] || 0) + 1;
        }
        for (const [pos, roles] of Object.entries(posRoleMap).sort()) {
            o.push("  " + pos + " -> roles: " + JSON.stringify(roles));
        }
        o.push("");

        // id_role unique values with count
        o.push("--- id_role values ---");
        const roleAll = {};
        for (const g of arr) roleAll[g.id_role || "?"] = (roleAll[g.id_role || "?"] || 0) + 1;
        for (const [r, c] of Object.entries(roleAll).sort((a,b) => b[1] - a[1])) o.push("  id_role=" + r + " -> " + c + " girls");
        o.push("");

        // Check if there are any other position-related fields
        o.push("--- Other position/role fields on girl[0] ---");
        const fg = arr[0];
        for (const k of Object.keys(fg)) {
            const lk = k.toLowerCase();
            if (lk.includes("position") || lk.includes("role") || lk.includes("pose") || lk.includes("fav")) {
                o.push("  " + k + " = " + JSON.stringify(fg[k]));
            }
        }
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

    setTimeout(()=>{const b=document.createElement("div");b.textContent="\ud83d\udd0d POS MAP";b.style.cssText="position:fixed;top:10px;right:10px;z-index:99999;background:#ff4444;color:white;padding:14px 20px;border-radius:5px;cursor:pointer;font-weight:bold;font-size:16px;box-shadow:0 2px 10px rgba(0,0,0,0.5);";b.onclick=dump;document.body.appendChild(b);},3000);
})();
