// ==UserScript==
// @name         HHAuto Login
// @namespace    https://github.com/Roukys/HHauto
// @version      1.0
// @description  HHAuto Login
// @author       Zary
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
// @match        https://connect.chibipass.com/*
// @grant        none
// ==/UserScript==

const userEmail = "YOUR_EMAIL";
const userPass = "YOUR_PASSWORD";

// Waiting for the element to appear.
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

// LOGIN (ChibiPass)
async function login() {
    try {
        const email = await waitForElement("#auth-email");
        const pass = await waitForElement("#auth-password");
        const btn = await waitForElement("#submit-authenticate");

        email.value = userEmail;
        pass.value = userPass;

        // Forces frameworks (React/Vue) to detect change.
        ["input", "change"].forEach(evt => {
            email.dispatchEvent(new Event(evt, { bubbles: true }));
            pass.dispatchEvent(new Event(evt, { bubbles: true }));
        });

        btn.disabled = false;
        btn.click();

        console.log("Login sent");
    } catch (err) {
        console.error("Login error:", err);
    }
}

// ENTER THE GAME (iframe)
function enterGame() {
    const tryClick = () => {
        const iframe = document.querySelector("#hh_game");
        if (!iframe) return false;

        try {
            const innerDoc = iframe.contentDocument || iframe.contentWindow.document;
            const btn = innerDoc?.querySelector(".igreen");

            if (btn) {
                btn.click();
                console.log("Entered the game.");
                return true;
            }
        } catch (e) {
            // Ignore cross-origin error
        }

        return false;
    };

    const interval = setInterval(() => {
        if (tryClick()) clearInterval(interval);
    }, 2000);
}

// CONTEXT DETECTION
function isLoginPage() {
    return window.location.hostname.includes("chibipass.com");
}

function isGamePage() {
    return !isLoginPage();
}

// INIT
function init() {
    if (!userEmail || !userPass) {
        console.warn("Credentials not defined");
        return;
    }

    if (isLoginPage()) {
        login();
    } else if (isGamePage()) {
        enterGame();
    }
}

// Ensures execution even on SPA (React) pages.
window.addEventListener("load", init);
document.addEventListener("DOMContentLoaded", init);
