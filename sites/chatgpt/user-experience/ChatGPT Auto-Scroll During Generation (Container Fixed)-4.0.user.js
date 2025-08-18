// ==UserScript==
// @name         ChatGPT Auto-Scroll During Generation (Container Fixed)
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Automatically smooth scroll during ChatGPT content generation - Fixed container detection
// @author       You
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    class ChatGPTAutoScroller {
        constructor() {
            this.isGenerating = false;
            this.scrollTimeout = null;
            this.generationTimeout = null;
            this.lastScrollTime = 0;
            this.scrollThrottle = 100;
            this.lastContentLength = 0;
            this.debugMode = true;
            this.scrollContainer = null;

            console.log('🚀 ChatGPT Auto-Scroller v4.0 - Container detection fixed');
            this.init();
        }

        init() {
            this.findScrollContainer();
            this.setupMutationObserver();
            this.addStatusIndicator();
        }

        findScrollContainer() {
            // Common selectors for ChatGPT's scroll container
            const possibleContainers = [
                'main[class*="scroll"]',
                '[class*="scroll-container"]',
                '[class*="conversation"]',
                'main',
                '.conversation',
                '#__next main',
                '[role="main"]',
                '.flex.flex-col.h-full'
            ];

            for (const selector of possibleContainers) {
                const container = document.querySelector(selector);
                if (container) {
                    const style = getComputedStyle(container);
                    // Check if this container is scrollable
                    if (style.overflow === 'auto' || style.overflow === 'scroll' ||
                        style.overflowY === 'auto' || style.overflowY === 'scroll' ||
                        container.scrollHeight > container.clientHeight) {
                        this.scrollContainer = container;
                        console.log(`📦 Found scroll container: ${selector}`);
                        break;
                    }
                }
            }

            // Fallback to window if no container found
            if (!this.scrollContainer) {
                this.scrollContainer = window;
                console.log('📦 Using window as scroll container (fallback)');
            }

            // Also try to find the main content area more dynamically
            this.findMainContentArea();
        }

        findMainContentArea() {
            // Look for the actual scrolling container more intelligently
            const allElements = document.querySelectorAll('*');

            for (const el of allElements) {
                const style = getComputedStyle(el);
                const hasScroll = (style.overflow === 'auto' || style.overflow === 'scroll' ||
                                 style.overflowY === 'auto' || style.overflowY === 'scroll');
                const isLargeEnough = el.clientHeight > 200 && el.scrollHeight > el.clientHeight;
                const containsMessages = el.querySelector('[data-message-author-role]');

                if (hasScroll && isLargeEnough && containsMessages) {
                    this.scrollContainer = el;
                    console.log('📦 Found dynamic scroll container:', el.className);
                    break;
                }
            }
        }

        addStatusIndicator() {
            this.indicator = document.createElement('div');
            this.indicator.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                background: #666;
                z-index: 9999;
                opacity: 0.8;
                transition: all 0.3s ease;
                cursor: pointer;
                box-shadow: 0 2px 8px rgba(0,0,0,0.2);
            `;
            this.indicator.title = 'Auto-scroll status (click to toggle debug)';
            this.indicator.addEventListener('click', () => {
                this.debugMode = !this.debugMode;
                console.log(`Debug mode: ${this.debugMode ? 'ON' : 'OFF'}`);
                // Re-find container when toggling debug
                this.findScrollContainer();
            });
            document.body.appendChild(this.indicator);
        }

        updateStatus(isActive) {
            if (this.indicator) {
                this.indicator.style.background = isActive ? '#4CAF50' : '#666';
                this.indicator.style.transform = isActive ? 'scale(1.2)' : 'scale(1)';
            }
        }

        setupMutationObserver() {
            this.observer = new MutationObserver((mutations) => {
                this.handleMutations(mutations);
            });

            this.observer.observe(document.body, {
                childList: true,
                subtree: true,
                characterData: true
            });
        }

        handleMutations(mutations) {
            let hasRelevantChange = false;

            for (const mutation of mutations) {
                if (this.isRelevantMutation(mutation)) {
                    hasRelevantChange = true;
                    break;
                }
            }

            if (hasRelevantChange) {
                this.onContentChange();
            }
        }

        isRelevantMutation(mutation) {
            const target = mutation.target;

            // Look for changes in the main conversation area
            const inMainContent = target.closest?.('main') ||
                                 document.querySelector('main')?.contains(target);

            if (!inMainContent) return false;

            // Text content changes
            if (mutation.type === 'characterData' && target.textContent?.trim()) {
                return true;
            }

            // New elements added
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
                        return true;
                    }
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        return true;
                    }
                }
            }

            return false;
        }

        onContentChange() {
            this.startGeneration();
            this.throttledScroll();
        }

        startGeneration() {
            if (!this.isGenerating) {
                this.isGenerating = true;
                this.updateStatus(true);
                console.log('📝 Content generation detected - auto-scroll enabled');
                // Re-find container in case layout changed
                if (!this.scrollContainer || this.scrollContainer === window) {
                    this.findScrollContainer();
                }
            }

            clearTimeout(this.generationTimeout);
            this.generationTimeout = setTimeout(() => {
                this.stopGeneration();
            }, 2000);
        }

        stopGeneration() {
            if (this.isGenerating) {
                this.isGenerating = false;
                this.updateStatus(false);
                console.log('✅ Content generation stopped - auto-scroll disabled');
            }
            clearTimeout(this.generationTimeout);
        }

        throttledScroll() {
            if (!this.isGenerating) return;

            const now = Date.now();

            if (now - this.lastScrollTime < this.scrollThrottle) {
                clearTimeout(this.scrollTimeout);
                this.scrollTimeout = setTimeout(() => {
                    this.performScroll();
                }, this.scrollThrottle - (now - this.lastScrollTime));
                return;
            }

            this.performScroll();
        }

        performScroll() {
            if (!this.isGenerating) return;

            this.lastScrollTime = Date.now();
            const scrollTarget = this.findVisibleScrollTarget();

            if (scrollTarget) {
                this.scrollToTarget(scrollTarget);
            } else if (this.debugMode) {
                console.log('❌ No visible scroll target found');
            }
        }

        findVisibleScrollTarget() {
            // Find ALL assistant messages first
            const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');

            if (assistantMessages.length === 0) {
                if (this.debugMode) console.log('❌ No assistant messages found at all');
                return null;
            }

            // Find the bottommost VISIBLE assistant message
            let bestTarget = null;
            let maxBottom = -Infinity;

            for (const message of assistantMessages) {
                const rect = message.getBoundingClientRect();

                // For container scrolling, we need to check visibility differently
                const containerRect = this.scrollContainer === window ?
                    { top: 0, bottom: window.innerHeight } :
                    this.scrollContainer.getBoundingClientRect();

                const isVisible = rect.height > 0 &&
                                rect.width > 0 &&
                                rect.bottom > containerRect.top - 1000 &&
                                rect.top < containerRect.bottom + 1000;

                if (this.debugMode) {
                    console.log(`🔍 Assistant message check:
                        Height: ${rect.height}
                        Width: ${rect.width}
                        Top: ${rect.top}
                        Bottom: ${rect.bottom}
                        Container Top: ${containerRect.top}
                        Container Bottom: ${containerRect.bottom}
                        Visible: ${isVisible}`);
                }

                if (isVisible && rect.bottom > maxBottom) {
                    maxBottom = rect.bottom;
                    bestTarget = message;
                }
            }

            if (bestTarget && this.debugMode) {
                console.log(`🎯 Selected visible target with bottom: ${maxBottom}`);
            }

            return bestTarget;
        }

        scrollToTarget(element) {
            const rect = element.getBoundingClientRect();
            const buffer = 100;

            let containerHeight, currentScrollTop, maxScrollTop;

            if (this.scrollContainer === window) {
                containerHeight = window.innerHeight;
                currentScrollTop = window.pageYOffset;
                maxScrollTop = document.documentElement.scrollHeight - window.innerHeight;
            } else {
                const containerRect = this.scrollContainer.getBoundingClientRect();
                containerHeight = containerRect.height;
                currentScrollTop = this.scrollContainer.scrollTop;
                maxScrollTop = this.scrollContainer.scrollHeight - containerHeight;
            }

            if (this.debugMode) {
                console.log(`📊 Scroll check:
                    Element bottom: ${rect.bottom}
                    Container height: ${containerHeight}
                    Current scroll: ${currentScrollTop}
                    Max scroll: ${maxScrollTop}
                    Buffer: ${buffer}`);
            }

            // Calculate if we need to scroll
            let needsScroll = false;
            let targetScroll = currentScrollTop;

            if (this.scrollContainer === window) {
                const overflow = rect.bottom - (containerHeight - buffer);
                if (overflow > 0) {
                    needsScroll = true;
                    targetScroll = currentScrollTop + overflow + 20;
                }
            } else {
                // For container scrolling, we need different logic
                const containerRect = this.scrollContainer.getBoundingClientRect();
                const relativeBottom = rect.bottom - containerRect.top;
                const overflow = relativeBottom - (containerHeight - buffer);

                if (overflow > 0) {
                    needsScroll = true;
                    targetScroll = currentScrollTop + overflow + 20;
                }
            }

            // Clamp to valid scroll range
            targetScroll = Math.min(Math.max(0, targetScroll), maxScrollTop);

            if (needsScroll && targetScroll !== currentScrollTop) {
                if (this.debugMode) {
                    console.log(`📜 SCROLLING: target: ${targetScroll}, current: ${currentScrollTop}`);
                }

                if (this.scrollContainer === window) {
                    window.scrollTo({
                        top: targetScroll,
                        behavior: 'smooth'
                    });
                } else {
                    this.scrollContainer.scrollTo({
                        top: targetScroll,
                        behavior: 'smooth'
                    });
                }
            } else if (this.debugMode) {
                console.log(`✋ No scroll needed (target: ${targetScroll}, current: ${currentScrollTop})`);
            }
        }

        destroy() {
            if (this.observer) {
                this.observer.disconnect();
            }
            clearTimeout(this.scrollTimeout);
            clearTimeout(this.generationTimeout);
            if (this.indicator?.parentNode) {
                this.indicator.remove();
            }
        }
    }

    // Initialize with better error handling
    let autoScroller = null;

    function initAutoScroller() {
        try {
            if (autoScroller) {
                autoScroller.destroy();
            }

            setTimeout(() => {
                autoScroller = new ChatGPTAutoScroller();
            }, 2000);
        } catch (error) {
            console.error('Failed to initialize auto-scroller:', error);
        }
    }

    // Handle page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAutoScroller);
    } else {
        initAutoScroller();
    }

    // Handle navigation
    let currentUrl = window.location.href;
    const checkUrlChange = () => {
        if (window.location.href !== currentUrl) {
            currentUrl = window.location.href;
            console.log('🔄 Navigation detected, reinitializing...');
            setTimeout(initAutoScroller, 1000);
        }
    };

    setInterval(checkUrlChange, 1000);

    // Cleanup
    window.addEventListener('beforeunload', () => {
        if (autoScroller) {
            autoScroller.destroy();
        }
    });
})();