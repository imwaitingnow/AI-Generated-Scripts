// ==UserScript==
// @name         Chat.z.ai Auto-Refresh Fix
// @namespace    your.namespace
// @version      1.0
// @description  Forces chat.z.ai to repaint so the chat updates without switching tabs
// @author       You
// @match        https://chat.z.ai/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Interval in ms – adjust if needed
    const interval = 1500;

    setInterval(() => {
        // Trigger a window resize event (forces repaint in many cases)
        window.dispatchEvent(new Event("resize"));

        // Tiny style toggle hack to force a reflow/repaint
        document.body.style.transform = "scale(1)";
        setTimeout(() => {
            document.body.style.transform = "";
        }, 50);
    }, interval);
})();
