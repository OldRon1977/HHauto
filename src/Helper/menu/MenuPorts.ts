// MenuPorts.ts
//
// Dependency-injection "ports" for the extracted menu leaf modules
// (MenuWidgets, MenuTemplate, MenuSettings). Those files need a handful of
// helpers (translations, config lookups, storage access, popup/default
// helpers) that all live inside the project's large import cycle ("SCC").
// Importing them statically would drag every menu/* file back into that cycle
// and grow the circular-dependency baseline.
//
// To keep the menu/* files as graph leaves, they read those helpers from this
// module instead. src/index.ts imports the real implementations (it sits
// outside every cycle) and calls setMenuPorts(...) once at boot, before any
// menu function runs -- the same wiring as setPachinkoAutoLoopKick /
// setBlockTick in src/index.ts.
//
// This module deliberately imports NOTHING from the project so it stays a leaf.
// `storedVarPrefix` is a plain string set at call time (never evaluated at
// module top level), so it does not trip the top-level-key TDZ guard.

// Shape of one HHStoredVars entry as read by the menu-settings binding. Kept
// deliberately loose (matching the untyped global config) but without an
// explicit `any`, so the menu leaf files stay within the lint budget.
export interface MenuStoredVarEntry {
    storage?: string;
    HHType?: string;
    customMenuID?: string;
    setMenu?: boolean;
    getMenu?: boolean;
    valueType?: string;
    menuType?: string;
    newValueFunction?: { apply: () => void };
    events?: Record<string, (...args: unknown[]) => void>;
    kobanUsing?: boolean;
    [key: string]: unknown;
}

export interface MenuPortsShape {
    getTextForUI: (id: string, type: string) => string;
    // Only ever called for "baseImgPath" from the leaf menu files, so the
    // string return type is accurate there.
    getHHScriptVars: (id: string) => string;
    getStoredValue: (inVarName: string) => unknown;
    getStorageItem: (inStorageType: string) => Storage;
    setStoredValue: (inVarName: string, inValue: unknown) => void;
    HHStoredVars: Record<string, MenuStoredVarEntry>;
    storedVarPrefix: string;
    logHHAuto: (message: string) => void;
    setDefaults: () => void;
    isDisplayedHHPopUp: () => unknown;
}

function notWired(name: string): never {
    throw new Error(`MenuPorts.${name} used before setMenuPorts() was called`);
}

// Mutable singleton. Populated by setMenuPorts() at boot. Initialised with
// guards so an accidental early call fails loudly instead of silently.
export const MenuPorts: MenuPortsShape = {
    getTextForUI: () => notWired("getTextForUI"),
    getHHScriptVars: () => notWired("getHHScriptVars"),
    getStoredValue: () => notWired("getStoredValue"),
    getStorageItem: () => notWired("getStorageItem"),
    setStoredValue: () => notWired("setStoredValue"),
    HHStoredVars: {},
    storedVarPrefix: "",
    logHHAuto: () => notWired("logHHAuto"),
    setDefaults: () => notWired("setDefaults"),
    isDisplayedHHPopUp: () => notWired("isDisplayedHHPopUp"),
};

export function setMenuPorts(ports: MenuPortsShape): void {
    Object.assign(MenuPorts, ports);
}
