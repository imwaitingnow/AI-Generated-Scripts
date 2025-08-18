// ==UserScript==
// @name         ChatGPT GPT-5 Announcement Background (Hue Shift Edition)
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Restores colorful moving GPT-5 style background on ChatGPT with smooth color cycling
// @author       imwaitingnow
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @grant        none
// @run-at       document-idle
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    console.log('🎨 GPT-5 Background Script Starting...');

    function addCSS(css) {
        if (!document.querySelector('#gpt5-bg-style')) {
            const style = document.createElement('style');
            style.id = 'gpt5-bg-style';
            style.textContent = css;
            document.head.appendChild(style);
            console.log('✅ CSS added');
        }
    }

    function createAnimatedBackground() {
        if (document.querySelector('#gpt5-bg-canvas')) return;

        const canvas = document.createElement('canvas');
        canvas.id = 'gpt5-bg-canvas';
        canvas.style.cssText = `
            position: fixed;
            inset: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
            pointer-events: none;
        `;
        document.body.prepend(canvas);

        const ctx = canvas.getContext('2d');
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        const colors = [
            'rgba(74, 144, 226, 0.4)',
            'rgba(80, 227, 194, 0.4)',
            'rgba(162, 155, 254, 0.4)',
            'rgba(255, 107, 107, 0.4)',
            'rgba(255, 206, 84, 0.4)',
            'rgba(129, 236, 236, 0.4)',
            'rgba(255, 159, 243, 0.4)',
            'rgba(161, 255, 206, 0.4)'
        ];

        class Particle {
            constructor() {
                this.reset();
                this.size = Math.random() * 40 + 15;
                this.color = colors[Math.floor(Math.random() * colors.length)];
                this.opacity = Math.random() * 0.4 + 0.1;
                this.pulseSpeed = Math.random() * 0.015 + 0.005;
                this.pulsePhase = Math.random() * Math.PI * 2;
            }
            reset() {
                this.x = Math.random() * width;
                this.y = Math.random() * height;
                this.speedX = (Math.random() - 0.5) * 1.5;
                this.speedY = (Math.random() - 0.5) * 1.5;
            }
            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                this.pulsePhase += this.pulseSpeed;
                if (this.x < 0 || this.x > width) this.speedX *= -1;
                if (this.y < 0 || this.y > height) this.speedY *= -1;
            }
            draw() {
                const pulseFactor = Math.sin(this.pulsePhase) * 0.3 + 0.7;
                const currentSize = this.size * pulseFactor;
                ctx.save();
                ctx.globalAlpha = this.opacity * pulseFactor;
                const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, currentSize);
                gradient.addColorStop(0, this.color);
                gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.arc(this.x, this.y, currentSize, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        }

        const particles = Array.from({ length: 30 }, () => new Particle());

        let hue = 0;
        function animate() {
            ctx.clearRect(0, 0, width, height);
            ctx.save();
            ctx.filter = `hue-rotate(${hue}deg)`;

            const bgGradient = ctx.createLinearGradient(0, 0, width, height);
            bgGradient.addColorStop(0, 'rgba(15, 23, 42, 0.95)');
            bgGradient.addColorStop(0.5, 'rgba(30, 41, 59, 0.95)');
            bgGradient.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
            ctx.fillStyle = bgGradient;
            ctx.fillRect(0, 0, width, height);

            particles.forEach(p => { p.update(); p.draw(); });

            ctx.restore();

            hue = (hue + 0.2) % 360; // smooth shift
            requestAnimationFrame(animate);
        }
        animate();

        window.addEventListener('resize', () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        });

        console.log('🎨 Background with hue shift ready');
    }

    function modifyChatGPTInterface() {
        const css = `
            body { background: transparent !important; }
            :is([class*="main"], [class*="container"], [class*="app"], [class*="chat"]) {
                background: transparent !important;
            }
            [class*="sidebar"], [class*="nav"], [class*="menu"] {
                background: rgba(15,23,42,0.8) !important;
                backdrop-filter: blur(10px);
            }
        `;
        addCSS(css);
    }

    function init() {
        createAnimatedBackground();
        modifyChatGPTInterface();
    }

    const observer = new MutationObserver(init);
    observer.observe(document.body, { childList: true, subtree: true });

    init();
})();
