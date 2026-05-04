// ==UserScript==
// @name         HHAuto Debug - Full Window Dump
// @namespace    HHAuto_Debug
// @version      2.0.0
// @description  Dumps ALL window/unsafeWindow arrays that contain girl-like objects
// @match        https://*.hentaiheroes.com/*
// @match        https://nutaku.haremheroes.com/*
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

(function() {
    "use strict";

    function isGirlLike(obj) {
        if (!obj || typeof obj !== "object") return false;
        // A girl object has id_girl or carac1 or name+level
        return (obj.id_girl !== undefined) || (obj.carac1 !== undefined) || (obj.name && obj.level !== undefined);
    }

    function dump() {
        const o = [];
        o.push("=== FULL DUMP v2.0 ===");
        o.push("Time: " + new Date().toISOString());
        o.push("URL: " + location.href);
        o.push("");

        // PART 1: Scan ALL keys on unsafeWindow
        o.push("--- PART 1: ALL unsafeWindow keys (type + size) ---");
        const allKeys = [];
        try {
            for (const k of Object.keys(unsafeWindow)) {
                try {
                    const v = unsafeWindow[k];
                    let info = typeof v;
                    if (v === null) info = "null";
                    else if (Array.isArray(v)) info = "Array[" + v.length + "]";
                    else if (info === "object") info = "Object{" + Object.keys(v).length + " keys}";
                    allKeys.push(k + " = " + info);
                } catch(e) { allKeys.push(k + " = [access error]"); }
            }
        } catch(e) { o.push("Error scanning window: " + e.message); }
        o.push("Total keys: " + allKeys.length);
        o.push(allKeys.join("\n"));
        o.push("");

        // PART 2: Scan unsafeWindow.shared if exists
        if (unsafeWindow.shared) {
            o.push("--- PART 2: ALL shared keys ---");
            const sk = [];
            try {
                for (const k of Object.keys(unsafeWindow.shared)) {
                    try {
                        const v = unsafeWindow.shared[k];
                        let info = typeof v;
                        if (v === null) info = "null";
                        else if (Array.isArray(v)) info = "Array[" + v.length + "]";
                        else if (info === "object") info = "Object{" + Object.keys(v).length + " keys}";
                        sk.push(k + " = " + info);
                    } catch(e) { sk.push(k + " = [access error]"); }
                }
            } catch(e) { o.push("Error: " + e.message); }
            o.push(sk.join("\n"));
            o.push("");
        } else {
            o.push("--- PART 2: window.shared does NOT exist ---");
            o.push("");
        }

        // PART 3: Find ALL arrays that contain girl-like objects
        o.push("--- PART 3: Arrays with girl-like objects ---");
        const girlArrays = [];
        const scanned = new Set();

        function scanObj(root, path, depth) {
            if (depth > 3) return;
            if (scanned.has(root)) return;
            scanned.add(root);
            try {
                for (const k of Object.keys(root)) {
                    try {
                        const v = root[k];
                        const fullPath = path + "." + k;
                        if (Array.isArray(v) && v.length > 0 && isGirlLike(v[0])) {
                            girlArrays.push({path: fullPath, length: v.length, sample: v[0]});
                        } else if (v && typeof v === "object" && !Array.isArray(v) && depth < 2) {
                            scanObj(v, fullPath, depth + 1);
                        }
                    } catch(e) {}
                }
            } catch(e) {}
        }

        scanObj(unsafeWindow, "window", 0);
        if (unsafeWindow.shared) scanObj(unsafeWindow.shared, "shared", 0);

        if (girlArrays.length === 0) {
            o.push("NO girl arrays found anywhere!");
            o.push("");
            o.push("This means availableGirls is not loaded yet.");
            o.push("The variable only exists when the team edit panel is actively showing girls.");
            o.push("");
        } else {
            for (const ga of girlArrays) {
                o.push("FOUND: " + ga.path + " (" + ga.length + " items)");
                o.push("  Sample keys: " + JSON.stringify(Object.keys(ga.sample).sort()));
                o.push("  Sample[0]: " + JSON.stringify(ga.sample).substring(0, 500));
                o.push("");
            }
        }

        // PART 4: Also dump ALL girl data if found
        if (girlArrays.length > 0) {
            const best = girlArrays.sort((a,b) => b.length - a.length)[0];
            const girls = unsafeWindow;
            let arr = null;
            try {
                const parts = best.path.replace("window.", "").replace("shared.", "").split(".");
                arr = best.path.startsWith("shared") ? unsafeWindow.shared : unsafeWindow;
                for (const p of parts) {
                    if (p === "window" || p === "shared") continue;
                    arr = arr[p];
                }
            } catch(e) {}

            if (arr && Array.isArray(arr)) {
                o.push("--- PART 4: Full girl data from " + best.path + " ---");
                o.push("Total: " + arr.length);
                o.push("");

                // Unique trait values
                const maps = {};
                for (const g of arr) {
                    for (const k of Object.keys(g)) {
                        const lk = k.toLowerCase();
                        if (lk.includes("color") || lk.includes("zodiac") || lk.includes("position") || lk.includes("element") || lk.includes("rarity")) {
                            if (!maps[k]) maps[k] = {};
                            const val = typeof g[k] === "object" ? JSON.stringify(g[k]) : String(g[k] || "EMPTY");
                            maps[k][val] = (maps[k][val] || 0) + 1;
                        }
                    }
                }
                o.push("--- Unique values per trait field ---");
                for (const [field, valMap] of Object.entries(maps)) {
                    const sorted = Object.entries(valMap).sort((a,b) => b[1] - a[1]);
                    o.push(field + " (" + sorted.length + " unique):");
                    for (const [v, c] of sorted) o.push("  " + v + " = " + c);
                    o.push("");
                }

                // Blessing analysis
                o.push("--- Blessing data ---");
                const bl = arr.filter(g => g.blessing_bonuses && Object.keys(g.blessing_bonuses).length > 0);
                o.push("Girls with blessing_bonuses: " + bl.length + " / " + arr.length);
                for (let i = 0; i < Math.min(5, bl.length); i++) {
                    const g = bl[i];
                    o.push("  " + (g.name||"?") + ": " + JSON.stringify(g.blessing_bonuses));
                    const s = (g.carac1||0)+(g.carac2||0)+(g.carac3||0);
                    o.push("    stats=" + s + " lvl=" + g.level + " gr=" + g.graded + " rarity=" + g.rarity);
                }
                o.push("");

                // Top 15
                o.push("--- Top 15 by stats ---");
                const top = [...arr].sort((a,b) => ((b.carac1||0)+(b.carac2||0)+(b.carac3||0)) - ((a.carac1||0)+(a.carac2||0)+(a.carac3||0))).slice(0, 15);
                for (const g of top) {
                    const s = (g.carac1||0)+(g.carac2||0)+(g.carac3||0);
                    const bm = (g.blessing_bonuses && Object.keys(g.blessing_bonuses).length > 0) ? "[B]" : "   ";
                    o.push("  " + bm + " " + (g.name||"?") + " s=" + s + " " + JSON.stringify({eye:g.eye_color1,hair:g.hair_color1,z:g.zodiac,pos:g.position_img,elem:g.element_data?g.element_data.type:g.element,r:g.rarity,l:g.level,g:g.graded}));
                }
                o.push("");

                // Full first 2 girls
                o.push("--- Full girl[0] and girl[1] ---");
                for (let i = 0; i < Math.min(2, arr.length); i++) {
                    const g = arr[i]; const rf = {};
                    for (const k of Object.keys(g)) {
                        if (typeof g[k] === "string" && g[k].length > 300) rf[k] = "[STR:" + g[k].length + "]";
                        else rf[k] = g[k];
                    }
                    o.push("girl[" + i + "]: " + JSON.stringify(rf, null, 2));
                    o.push("");
                }
            }
        }

        // PART 5: localStorage blessing cache
        o.push("--- PART 5: Blessing Cache ---");
        try {
            const ck = Object.keys(localStorage).find(k => k.includes("blessingsCache"));
            if (ck) {
                o.push("Key: " + ck);
                o.push(localStorage.getItem(ck));
            } else {
                o.push("No blessingsCache in localStorage");
            }
        } catch(e) { o.push("Error: " + e.message); }
        o.push("");
        o.push("=== END ===");

        // Show
        const text = o.join("\n");
        console.log(text);
        const ov = document.createElement("div");
        ov.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;";
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "width:90%;height:82%;font:11px monospace;padding:10px;border-radius:5px;background:#1a1a1a;color:#0f0;";
        const row = document.createElement("div");
        row.style.cssText = "margin-top:10px;display:flex;gap:10px;";
        const cp = document.createElement("button");
        cp.textContent = "COPY ALL";
        cp.style.cssText = "padding:12px 24px;font-size:16px;cursor:pointer;background:#4CAF50;color:white;border:none;border-radius:4px;font-weight:bold;";
        cp.onclick = () => { ta.select(); document.execCommand("copy"); cp.textContent = "COPIED!"; };
        const cl = document.createElement("button");
        cl.textContent = "CLOSE";
        cl.style.cssText = "padding:12px 24px;font-size:16px;cursor:pointer;background:#f44336;color:white;border:none;border-radius:4px;font-weight:bold;";
        cl.onclick = () => ov.remove();
        row.appendChild(cp); row.appendChild(cl);
        ov.appendChild(ta); ov.appendChild(row);
        document.body.appendChild(ov);
        ta.select();
    }

    setTimeout(() => {
        const b = document.createElement("div");
        b.textContent = "\ud83d\udd0d FULL DUMP";
        b.style.cssText = "position:fixed;top:10px;right:10px;z-index:99999;background:#ff4444;color:white;padding:14px 20px;border-radius:5px;cursor:pointer;font-weight:bold;font-size:16px;box-shadow:0 2px 10px rgba(0,0,0,0.5);";
        b.onclick = dump;
        document.body.appendChild(b);
    }, 3000);
})();
