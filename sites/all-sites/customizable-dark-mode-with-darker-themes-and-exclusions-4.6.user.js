// ==UserScript==
// @name         Customizable Dark Mode with Darker Themes and Exclusions
// @namespace    http://tampermonkey.net/
// @version      4.6
// @description  Applies customizable dark mode or very dark color themes to different websites. Users can exclude specific sites from theming and manage exclusions via the Tampermonkey settings page.
// @author       skyline/imwaitingnow
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // Darker predefined color themes
    const colorThemes = {
        "Dark Mode": { bgColor: "#121212", borderColor: "#1C1C1C" },
        "Orange": { bgColor: "#4D1F00", borderColor: "#3B1700" },  // Very Dark Orange
        "Blue": { bgColor: "#0A0F3D", borderColor: "#020828" },  // Very Dark Blue
        "Red": { bgColor: "#4D0000", borderColor: "#2B0000" },  // Very Dark Red
        "Green": { bgColor: "#0C2D0C", borderColor: "#021802" }  // Very Dark Green
    };

    // Get the current domain
    const domain = window.location.hostname;

    // Retrieve exclusions and themes from storage
    let exclusions = GM_getValue('exclusions', []);
    let selectedTheme = getThemeForDomain(domain);
    let textColor = "#FFFFFF";  // Text color set to white
    let linkColor = GM_getValue('linkColor', '#BB86FC');
    let visitedLinkColor = GM_getValue('visitedLinkColor', '#6200EE');
    let bgColor = colorThemes[selectedTheme]?.bgColor || colorThemes["Dark Mode"].bgColor;
    let borderColor = colorThemes[selectedTheme]?.borderColor || colorThemes["Dark Mode"].borderColor;

    function applyStyles() {
        // Check if the current domain is excluded
        if (exclusions.includes(domain)) {
            return;
        }

        let darkModeStyles = `
            body, html, div, span, applet, object, iframe,
            h1, h2, h3, h4, h5, h6, p, blockquote, pre,
            a, abbr, acronym, address, big, cite, code,
            del, dfn, em, img, ins, kbd, q, s, samp,
            small, strike, strong, sub, sup, tt, var,
            b, u, i, center,
            dl, dt, dd, ol, ul, li,
            fieldset, form, label, legend,
            table, caption, tbody, tfoot, thead, tr, th, td,
            article, aside, canvas, details, embed,
            figure, figcaption, footer, header, hgroup,
            menu, nav, output, ruby, section, summary,
            time, mark, audio, video {
                background-color: ${bgColor} !important;
                color: ${textColor} !important;
                border-color: ${borderColor} !important;
            }
            a {
                color: ${linkColor} !important;
            }
            a:visited {
                color: ${visitedLinkColor} !important;
            }
            input, textarea, select, button {
                background-color: ${borderColor} !important;
                color: ${textColor} !important;
                border-color: ${borderColor} !important;
            }
        `;

        // Additional CSS for Greasy Fork
        if (window.location.hostname.includes("greasyfork.org")) {
            darkModeStyles += `
                #main-header {
                    background-color: ${borderColor} !important;
                    background-image: linear-gradient(${borderColor}, #333333) !important;
                    box-shadow: 0 0 15px 2px #00000080 !important;
                }
                .user-content {
                    background: linear-gradient(to right, ${bgColor}, ${borderColor} 1em) !important;
                    background-color: rgba(0, 0, 0, 0) !important;
                    border-left: 2px solid #444444 !important;
                    padding: .5em 1em !important;
                    overflow-x: auto !important;
                }
            `;
        }

        // Additional CSS for 1337x.to
        if (window.location.hostname.includes("1337x.to")) {
            darkModeStyles += `
                .search-categories .icon::after {
                    content: '';
                    position: absolute;
                    right: 0;
                    top: -6px;
                    background-color: ${borderColor} !important;
                    height: 100%;
                    width: 50%;
                    transform: rotate(-20deg);
                    border-bottom-right-radius: 100px;
                    border-top-right-radius: 100px;
                }
            `;
        }

        // Additional CSS for The Fappening Blog
        if (window.location.hostname.includes("thefappeningblog.com")) {
            darkModeStyles += `
                .block-header, .menu-tabHeader, .menu-header {
                    padding: 6px 15px !important;
                    margin: 0 !important;
                    font-weight: 400 !important;
                    text-decoration: none !important;
                    color: ${linkColor} !important;
                    background: linear-gradient(0deg, ${borderColor}, ${bgColor}) !important;
                    border-bottom: 1px solid ${borderColor} !important;
                }
                .menu-footer {
                    padding: 6px 15px !important;
                    font-size: 12px !important;
                    color: ${textColor} !important;
                    background: linear-gradient(180deg, ${borderColor}, ${bgColor}) !important;
                    border-top: 1px solid ${borderColor} !important;
                }
                .block-filterBar {
                    padding: 6px 10px !important;
                    font-size: 13px !important;
                    color: ${linkColor} !important;
                    background: linear-gradient(0deg, ${borderColor}, ${bgColor}) !important;
                    border-bottom: 1px solid ${borderColor} !important;
                }
            `;
        }

        // Additional CSS for Crackshash
        if (window.location.hostname.includes("crackshash.com")) {
            darkModeStyles += `
                header.masthead::before {
                    content: "";
                    position: absolute;
                    background-color: ${borderColor} !important;
                    height: 100%;
                    width: 100%;
                    top: 0;
                    left: 0;
                    opacity: 0.5;
                }
            `;
        }

        // Inject the dark mode styles immediately
        var styleElement = document.createElement('style');
        styleElement.type = 'text/css';
        styleElement.appendChild(document.createTextNode(darkModeStyles));

        document.documentElement.appendChild(styleElement);
    }

    function openSettings() {
        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div id="settingsWrapper" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 10000; background: #222; padding: 20px; border-radius: 10px; color: white; box-shadow: 0px 0px 10px rgba(0,0,0,0.5); font-family: Arial, sans-serif;">
                <h2 style="margin-bottom: 10px; font-size: 20px; color: #ffffff;">Theme Settings</h2>
                <label for="themeSelector" style="font-size: 14px; color: #dddddd;">Select Theme:</label>
                <select id="themeSelector" style="display: block; margin-bottom: 20px; padding: 5px 10px; font-size: 14px; background: #444; color: white; border: 1px solid #666; border-radius: 5px;">
                    ${Object.keys(colorThemes).map(theme => `<option value="${theme}" ${theme === selectedTheme ? 'selected' : ''}>${theme}</option>`).join('')}
                </select>
                <button id="saveSettings" style="margin-right: 10px; padding: 5px 10px; font-size: 14px; background: #009688; color: white; border: none; border-radius: 5px; cursor: pointer;">Save</button>
                <button id="cancelSettings" style="padding: 5px 10px; font-size: 14px; background: #555; color: white; border: none; border-radius: 5px; cursor: pointer;">Cancel</button>
                <hr style="margin: 20px 0;">
                <h3 style="margin-bottom: 10px; font-size: 16px; color: #ffffff;">Exclusions</h3>
                <button id="excludeSite" style="padding: 5px 10px; font-size: 14px; background: #ff5722; color: white; border: none; border-radius: 5px; cursor: pointer;">Exclude This Site</button>
                <ul id="exclusionsList" style="list-style: none; padding-left: 0; font-size: 14px;">
                    ${exclusions.map(exclusion => `<li>${exclusion} <button class="removeExclusion" style="margin-left: 10px; background: #e57373; color: white; border: none; border-radius: 3px; cursor: pointer;">Remove</button></li>`).join('')}
                </ul>
            </div>
        `;
        document.body.appendChild(wrapper);

        document.getElementById('saveSettings').addEventListener('click', function() {
            selectedTheme = document.getElementById('themeSelector').value;
            bgColor = colorThemes[selectedTheme].bgColor;
            borderColor = colorThemes[selectedTheme].borderColor;

            setThemeForDomain(domain, selectedTheme);
            applyStyles();

            document.body.removeChild(wrapper);
        });

        document.getElementById('cancelSettings').addEventListener('click', function() {
            document.body.removeChild(wrapper);
        });

        document.getElementById('excludeSite').addEventListener('click', function() {
            if (!exclusions.includes(domain)) {
                exclusions.push(domain);
                GM_setValue('exclusions', exclusions);
                alert('This site has been excluded from theming.');
                document.getElementById('exclusionsList').innerHTML += `<li>${domain} <button class="removeExclusion" style="margin-left: 10px; background: #e57373; color: white; border: none; border-radius: 3px; cursor: pointer;">Remove</button></li>`;
            }
        });

        document.querySelectorAll('.removeExclusion').forEach(button => {
            button.addEventListener('click', function() {
                const exclusion = this.parentElement.textContent.trim().split(' ')[0];
                exclusions = exclusions.filter(e => e !== exclusion);
                GM_setValue('exclusions', exclusions);
                this.parentElement.remove();
            });
        });
    }

    function getThemeForDomain(domain) {
        return GM_getValue(`theme_${domain}`, 'Dark Mode');
    }

    function setThemeForDomain(domain, theme) {
        GM_setValue(`theme_${domain}`, theme);
    }

    // Register menu command for opening settings
    GM_registerMenuCommand("Theme Settings", openSettings);

    // Apply styles initially
    applyStyles();
})();
