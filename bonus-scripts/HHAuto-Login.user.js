// ==UserScript==
// @name         HHAuto Login
// @namespace    https://github.com/OldRon1977/HHauto
// @version      1.3
// @description  HHAuto Login
// @author       Zary, OldRon1977
// @match        https://connect.chibipass.com/*
// @match        http*://*.haremheroes.com/
// @match        http*://*.hentaiheroes.com/
// @match        http*://*.gayharem.com/
// @match        http*://*.comixharem.com/
// @match        http*://*.hornyheroes.com/
// @match        http*://*.pornstarharem.com/
// @match        http*://*.transpornstarharem.com/
// @match        http*://*.gaypornstarharem.com/
// @match        http*://*.mangarpg.com/
// @match        http*://*.amouragent.com/
// @grant        none
// ==/UserScript==

// ============================== READ THIS FIRST ===============================
//
// WHAT THIS SCRIPT DOES
// It types your ChibiPass e-mail and password into the login form for you and
// clicks the login button, then clicks the "enter game" button on the game's
// landing page if one is shown. That is the whole feature. It is a convenience
// helper for logging in, nothing more.
//
// IT SENDS NOTHING ANYWHERE
// Your credentials go into the two input fields of the official ChibiPass login
// form and nowhere else -- exactly where you would type them yourself. The
// script contains no fetch, no XMLHttpRequest, no sendBeacon, no WebSocket, no
// image or link tricks, and it declares "@grant none", so it has no access to
// privileged userscript APIs at all. It does not read cookies, it does not touch
// localStorage or sessionStorage, and it reports nothing to the author or to any
// third party. You can verify every word of that by reading the code below.
//
// THE RISK, PLAINLY
// The risk is not transmission. The risk is THE FILE ITSELF: once you fill in
// the two constants below, this script contains your password in plain text and
// lives inside your userscript manager's storage. Anyone or anything that can
// read that storage can read your password:
//   - another person using the same machine or user account
//   - Tampermonkey sync, browser profile sync, or any cloud backup you enabled
//   - a copy of this file you sent, uploaded, pasted, or committed somewhere
//   - malware running under your user account
//
// SO: KEEP IT LOCAL AND YOU ARE FINE
// This script is meant to run purely locally, on your own machine. If you keep
// the filled-in file to yourself, the exposure is the same as writing the
// password in a text file on your desktop -- acceptable to many people, and
// entirely your call.
//   - use it on a private, single-user machine
//   - turn OFF userscript/browser sync for this script, or do not use it at all
//   - never share, upload, paste, or commit this file after filling it in
//   - use a password unique to the game, so even a leak cannot spread further
//   - clear the two constants back to their placeholders before you hand the
//     file to anyone, including when reporting a bug
//
// If you are not comfortable with that trade-off, do not use this script: log in
// by hand. HHAuto itself works fine without it.
//
// SCOPE
// The @match list is intentionally minimal: the ChibiPass login form (where the
// credentials are entered) plus the landing page ("/") of each game domain,
// which is where the enter-game click belongs. Do not widen it; every extra
// page a credential-bearing script runs on increases exposure. Remove the game
// domains you do not play.
//
// The ChibiPass entry is not a page of its own. Its bare root serves an empty
// document; the form is delivered as an iframe of the game's home.html, which
// the landing page in turn holds in its #hh_game iframe:
//
//     /                                    <- landing page, enterGame() runs here
//     +- /home.html                        <- the game itself
//        +- connect.chibipass.com/authentication/start_authentication?...
//                                          <- the form, login() runs here
//
// So the script only reaches the form because it does not declare @noframes.
// That is what carries the login half -- do not add @noframes, and do not drop
// the chibipass @match as unused. Because that @match is tested against the
// frame's own URL, the login works from either entry point; the enter-game half
// only runs when the landing page "/" is the top document.
// ==============================================================================

const userEmail = "YOUR_EMAIL";
const userPass = "YOUR_PASSWORD";

function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
        const interval = 200;
        let elapsed = 0;

        const timer = setInterval(() => {
            const el = document.querySelector(selector);
            if (el) {
                clearInterval(timer);
                resolve(el);
            }

            elapsed += interval;
            if (elapsed >= timeout) {
                clearInterval(timer);
                reject(`Element not found: ${selector}`);
            }
        }, interval);
    });
}

// Runs inside the ChibiPass form iframe (see SCOPE above).
async function login() {
    try {
        const email = await waitForElement("#auth-email");
        const pass = await waitForElement("#auth-password");
        const btn = await waitForElement("#submit-authenticate");

        email.value = userEmail;
        pass.value = userPass;

        // The page's own validation listens for these, and dispatching them
        // is what makes it accept the values and enable the submit button.
        // The form is plain server-rendered HTML -- no React, no Vue, no value
        // tracker on the inputs -- so assigning .value directly is enough. An
        // input backed by a framework would ignore this and need the native
        // value setter instead.
        ["input", "change"].forEach(evt => {
            email.dispatchEvent(new Event(evt, { bubbles: true }));
            pass.dispatchEvent(new Event(evt, { bubbles: true }));
        });

        // The page enables the button itself once it has seen both inputs.
        // Only force it if that did not happen: after the click the page sets
        // disabled again as its own guard against a double submit, and
        // clearing it unconditionally would defeat that guard.
        if (btn.disabled) btn.disabled = false;
        btn.click();

        console.log("Login sent");
    } catch (err) {
        console.error("Login error:", err);
    }
}

// Runs on the game's landing page, which holds the game in an #hh_game iframe.
function enterGame() {
    const maxAttempts = 30; // 30 x 2s -- one minute, then give up quietly
    let attempts = 0;

    const tryClick = () => {
        const iframe = document.querySelector("#hh_game");
        if (!iframe) return false;

        try {
            const innerDoc = iframe.contentDocument || iframe.contentWindow.document;
            const btn = innerDoc?.querySelector(".igreen");

            // While logged out, the only .igreen on the landing page is the
            // login icon inside a[rel='phoenix_member_login']. Clicking that
            // and stopping would end the search before the enter-game button
            // has appeared, so skip it and keep looking.
            if (btn && !btn.closest("a[rel='phoenix_member_login']")) {
                btn.click();
                console.log("Entered the game.");
                return true;
            }
        } catch (e) {
            // contentDocument throws on a cross-origin iframe. It is
            // same-origin on hentaiheroes.com, so this is a guard for the
            // other domains, not the normal path.
        }

        return false;
    };

    const interval = setInterval(() => {
        if (tryClick() || ++attempts >= maxAttempts) clearInterval(interval);
    }, 2000);
}

function isLoginPage() {
    return window.location.hostname.includes("chibipass.com");
}

function isGamePage() {
    return !isLoginPage();
}

function init() {
    if (!userEmail || !userPass
        || userEmail === "YOUR_EMAIL" || userPass === "YOUR_PASSWORD") {
        console.warn("Credentials not defined");
        return;
    }

    if (isLoginPage()) {
        login();
    } else if (isGamePage()) {
        enterGame();
    }
}

// "load" is the one start point. At the default @run-at document-end the
// DOMContentLoaded event has already been dispatched, so a listener for it
// never fires; at document-start both would fire and init would run twice,
// submitting the form a second time. The ChibiPass form is server-rendered,
// not an SPA, so there is nothing later to wait for.
window.addEventListener("load", init);
