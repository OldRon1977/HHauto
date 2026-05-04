// ==UserScript==
// @name         HHAuto Debug - Girl Data Inspector
// @namespace    HHAuto_Debug
// @version      1.1.0
// @description  Dumps girl trait data, blessing info, color codes for Issue 1580
// @match        https://*.hentaiheroes.com/*
// @match        https://nutaku.haremheroes.com/*
// @grant        unsafeWindow
// @run-at       document-idle
// ==/UserScript==

(function() {
    "use strict";
    const WAIT_MS = 5000;

    function getGameVar(path) {
        let root = unsafeWindow;
        if (root.shared && path.indexOf("Hero.") === 0) path = "shared." + path;
        for (const part of path.split(".")) {
            if (root[part] === undefined) return null;
            root = root[part];
        }
        return root;
    }

    function findGirls() {
        const tries = [
            () => getGameVar("availableGirls"),
            () => unsafeWindow.availableGirls,
            () => unsafeWindow.shared && unsafeWindow.shared.availableGirls,
            () => unsafeWindow.girlsDataList,
            () => unsafeWindow.shared && unsafeWindow.shared.girlsDataList,
            () => { for (const k of Object.keys(unsafeWindow)) { try { const v=unsafeWindow[k]; if(Array.isArray(v)&&v.length>10&&v[0]&&v[0].id_girl&&v[0].carac1!==undefined) return v; } catch(e){} } return null; }
        ];
        for (const t of tries) { try { const g=t(); if(g&&Array.isArray(g)&&g.length>0) return g; } catch(e){} }
        return null;
    }

    function findFromDOM() {
        const gs=[];
        for (const el of document.querySelectorAll("div[id_girl]")) {
            const gi=el.querySelector(".girl_img");
            if(!gi) continue;
            for (const a of gi.attributes) { try { const d=JSON.parse(a.value); if(d&&(d.id_girl||d.carac1!==undefined)){gs.push(d);break;} } catch(e){} }
        }
        return gs.length>0?gs:null;
    }

    function dump() {
        let girls=findGirls(), src="gameVar";
        if(!girls){girls=findFromDOM();src="DOM";}
        const o=[];
        o.push("=== HHAuto Debug Inspector v1.1 ===");
        o.push("Time: "+new Date().toISOString());
        o.push("URL: "+location.href);
        o.push("Source: "+src);
        o.push("");

        // Globals
        o.push("--- Globals ---");
        const rk=[];
        try{for(const k of Object.keys(unsafeWindow)){const l=k.toLowerCase();if(l.includes("girl")||l.includes("available")||l.includes("harem")){let t=typeof unsafeWindow[k];if(Array.isArray(unsafeWindow[k]))t="arr["+unsafeWindow[k].length+"]";rk.push(k+"("+t+")");}}}catch(e){}
        o.push("Window: "+rk.join(", "));
        if(unsafeWindow.shared){const sk=[];try{for(const k of Object.keys(unsafeWindow.shared)){const l=k.toLowerCase();if(l.includes("girl")||l.includes("available")){let t=typeof unsafeWindow.shared[k];if(Array.isArray(unsafeWindow.shared[k]))t="arr["+unsafeWindow.shared[k].length+"]";sk.push(k+"("+t+")");}}}catch(e){}o.push("Shared: "+sk.join(", "));}
        o.push("");

        if(!girls){o.push("ERROR: No girl data found! Open Change Team panel first.");show(o.join("\n"));return;}

        o.push("Girls found: "+girls.length);
        o.push("");

        // Fields
        o.push("--- Fields on girl[0] ---");
        o.push(JSON.stringify(Object.keys(girls[0]).sort()));
        o.push("");

        // First 5 trait data
        o.push("--- Trait data (first 5) ---");
        for(let i=0;i<Math.min(5,girls.length);i++){const g=girls[i];const d={};for(const k of Object.keys(g)){const l=k.toLowerCase();if(l.includes("color")||l.includes("eye")||l.includes("hair")||l.includes("bless")||l.includes("position")||l.includes("zodiac")||l.includes("element")||l.includes("rarity")||k==="name"||k==="id_girl"||l.includes("carac")||k==="level"||k==="graded"||k==="nb_grades")d[k]=g[k];}o.push(i+". "+(g.name||"?")+": "+JSON.stringify(d));}
        o.push("");

        // Blessings
        o.push("--- Blessings ---");
        const bl=girls.filter(g=>g.blessing_bonuses&&Object.keys(g.blessing_bonuses).length>0);
        const nbl=girls.filter(g=>!g.blessing_bonuses||Object.keys(g.blessing_bonuses).length===0);
        o.push("Blessed: "+bl.length+", Not: "+nbl.length);
        for(let i=0;i<Math.min(5,bl.length);i++){const g=bl[i];o.push("  "+g.name+" eye="+g.eye_color1+" hair="+g.hair_color1+" z="+g.zodiac+" pos="+g.position_img);o.push("    bonuses="+JSON.stringify(g.blessing_bonuses));o.push("    c1="+g.carac1+" c2="+g.carac2+" c3="+g.carac3+" sum="+((g.carac1||0)+(g.carac2||0)+(g.carac3||0))+" elem="+(g.element_data?g.element_data.type:g.element));}
        o.push("");

        // Unique values
        o.push("--- Unique trait values ---");
        const m={eye:{},hair:{},pos:{},zodiac:{}};
        for(const g of girls){m.eye[g.eye_color1||"?"]=(m.eye[g.eye_color1||"?"]||0)+1;m.hair[g.hair_color1||"?"]=(m.hair[g.hair_color1||"?"]||0)+1;m.pos[g.position_img||"?"]=(m.pos[g.position_img||"?"]||0)+1;m.zodiac[g.zodiac||"?"]=(m.zodiac[g.zodiac||"?"]||0)+1;}
        for(const[f,map] of Object.entries(m)){o.push(f+":");for(const[v,c] of Object.entries(map).sort((a,b)=>b[1]-a[1]))o.push("  "+v+" = "+c);o.push("");}

        // Cache
        o.push("--- Blessing Cache ---");
        try{const ck=Object.keys(localStorage).find(k=>k.includes("blessingsCache"));if(ck){const c=JSON.parse(localStorage.getItem(ck));o.push("traits="+JSON.stringify(c.blessedTraits));o.push("values="+JSON.stringify(c.blessedValues));if(c.raw&&c.raw.active)for(const b of c.raw.active)o.push("  "+b.title+": "+b.description);}else o.push("Not found");}catch(e){o.push("Err: "+e.message);}
        o.push("");

        // Stat compare
        o.push("--- Stat compare ---");
        const bm=bl.filter(g=>g.rarity==="mythic").sort((a,b)=>((b.carac1||0)+(b.carac2||0)+(b.carac3||0))-((a.carac1||0)+(a.carac2||0)+(a.carac3||0)));
        const nm=nbl.filter(g=>g.rarity==="mythic").sort((a,b)=>((b.carac1||0)+(b.carac2||0)+(b.carac3||0))-((a.carac1||0)+(a.carac2||0)+(a.carac3||0)));
        if(bm.length&&nm.length){const bs=(bm[0].carac1||0)+(bm[0].carac2||0)+(bm[0].carac3||0),ns=(nm[0].carac1||0)+(nm[0].carac2||0)+(nm[0].carac3||0);o.push("Blessed: "+bm[0].name+" sum="+bs+" lvl="+bm[0].level+" gr="+bm[0].graded);o.push("NotBl: "+nm[0].name+" sum="+ns+" lvl="+nm[0].level+" gr="+nm[0].graded);o.push("Ratio: "+(bs/ns).toFixed(4)+" (>1.25 = carac includes blessing)");}
        o.push("");

        // Top 15
        o.push("--- Top 15 M+L ---");
        const top=[...girls].filter(g=>g.rarity==="mythic"||(g.rarity==="legendary"&&(g.nb_grades||0)>=5)).sort((a,b)=>((b.carac1||0)+(b.carac2||0)+(b.carac3||0))-((a.carac1||0)+(a.carac2||0)+(a.carac3||0))).slice(0,15);
        for(const g of top){const s=(g.carac1||0)+(g.carac2||0)+(g.carac3||0);const b=(g.blessing_bonuses&&Object.keys(g.blessing_bonuses).length>0)?"[B]":"   ";o.push(b+" "+(g.name||"?")+" sum="+s+" eye="+g.eye_color1+" hair="+g.hair_color1+" z="+g.zodiac+" pos="+g.position_img+" e="+(g.element_data?g.element_data.type:g.element)+" "+g.rarity+" l="+g.level+" g="+g.graded);}
        o.push("");

        // Full first girl
        o.push("--- Full girl[0] ---");
        const fg=girls[0],rf={};for(const k of Object.keys(fg)){if(typeof fg[k]==="string"&&fg[k].length>200){rf[k]="[STR:"+fg[k].length+"]";}else if(typeof fg[k]==="object"&&fg[k]&&JSON.stringify(fg[k]).length>500){rf[k]="[OBJ:"+Object.keys(fg[k]).join(",")+"]";}else{rf[k]=fg[k];}}
        o.push(JSON.stringify(rf,null,2));
        o.push("");
        o.push("=== END ===");
        show(o.join("\n"));
    }

    function show(text) {
        console.log(text);
        const ov=document.createElement("div");ov.style.cssText="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;";
        const ta=document.createElement("textarea");ta.value=text;ta.style.cssText="width:85%;height:80%;font:11px monospace;padding:10px;border-radius:5px;";ta.readOnly=true;
        const row=document.createElement("div");row.style.cssText="margin-top:10px;display:flex;gap:10px;";
        const cp=document.createElement("button");cp.textContent="Copy";cp.style.cssText="padding:10px 20px;font-size:14px;cursor:pointer;background:#4CAF50;color:white;border:none;border-radius:4px;";cp.onclick=()=>{ta.select();document.execCommand("copy");cp.textContent="Copied!";};
        const cl=document.createElement("button");cl.textContent="Close";cl.style.cssText="padding:10px 20px;font-size:14px;cursor:pointer;background:#f44336;color:white;border:none;border-radius:4px;";cl.onclick=()=>ov.remove();
        row.appendChild(cp);row.appendChild(cl);ov.appendChild(ta);ov.appendChild(row);document.body.appendChild(ov);ta.select();
    }

    setTimeout(()=>{const b=document.createElement("div");b.textContent="\ud83d\udd0d DUMP";b.style.cssText="position:fixed;top:10px;right:10px;z-index:99999;background:#ff4444;color:white;padding:12px 18px;border-radius:5px;cursor:pointer;font-weight:bold;font-size:14px;box-shadow:0 2px 10px rgba(0,0,0,0.3);";b.onclick=dump;document.body.appendChild(b);},WAIT_MS);
})();
