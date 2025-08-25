// ==UserScript==
// @name         Smart Image Text Selector (OCR Region)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Draw a box on an image to extract text from that area using OCR (Tesseract.js)
// @author       You
// @match        *://*/*
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/tesseract.js@5.0.1/dist/tesseract.min.js
// ==/UserScript==

(function () {
    'use strict';

    const addOverlayUI = () => {
        let startX, startY, endX, endY;
        let isDrawing = false;
        let selectionBox;
        let targetImg;

        document.querySelectorAll('img').forEach(img => {
            img.style.cursor = 'crosshair';
            img.addEventListener('mousedown', e => {
                if (e.button !== 0) return; // left click only
                targetImg = img;
                const rect = img.getBoundingClientRect();
                startX = e.clientX - rect.left;
                startY = e.clientY - rect.top;
                isDrawing = true;

                selectionBox = document.createElement('div');
                selectionBox.style.position = 'absolute';
                selectionBox.style.border = '2px dashed red';
                selectionBox.style.zIndex = 9999;
                document.body.appendChild(selectionBox);
            });

            img.addEventListener('mousemove', e => {
                if (!isDrawing || !selectionBox) return;
                const rect = img.getBoundingClientRect();
                const currentX = e.clientX - rect.left;
                const currentY = e.clientY - rect.top;

                const left = Math.min(startX, currentX);
                const top = Math.min(startY, currentY);
                const width = Math.abs(currentX - startX);
                const height = Math.abs(currentY - startY);

                Object.assign(selectionBox.style, {
                    left: `${rect.left + left}px`,
                    top: `${rect.top + top}px`,
                    width: `${width}px`,
                    height: `${height}px`
                });
            });

            img.addEventListener('mouseup', async e => {
                if (!isDrawing || !selectionBox) return;
                isDrawing = false;

                const rect = img.getBoundingClientRect();
                endX = e.clientX - rect.left;
                endY = e.clientY - rect.top;

                const cropX = Math.min(startX, endX);
                const cropY = Math.min(startY, endY);
                const cropWidth = Math.abs(endX - startX);
                const cropHeight = Math.abs(endY - startY);

                document.body.removeChild(selectionBox);

                const canvas = document.createElement('canvas');
                canvas.width = cropWidth * 2; // upscale
                canvas.height = cropHeight * 2;

                const ctx = canvas.getContext('2d');
                ctx.scale(2, 2);
                ctx.drawImage(targetImg, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

                // Optional: preprocess (grayscale)
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                for (let i = 0; i < imageData.data.length; i += 4) {
                    const avg = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
                    imageData.data[i] = avg;
                    imageData.data[i + 1] = avg;
                    imageData.data[i + 2] = avg;
                }
                ctx.putImageData(imageData, 0, 0);

                const { data: { text } } = await Tesseract.recognize(canvas, 'eng', {
                    logger: m => console.log(m)
                });

                showTextOverlay(text, e.clientX, e.clientY);
            });
        });
    };

    const showTextOverlay = (text, x, y) => {
        const box = document.createElement('textarea');
        box.value = text.trim() || '[No text detected]';
        Object.assign(box.style, {
            position: 'fixed',
            left: `${x + 10}px`,
            top: `${y + 10}px`,
            zIndex: 10000,
            background: '#fff',
            color: '#000',
            border: '1px solid #333',
            padding: '10px',
            fontSize: '14px',
            width: '300px',
            height: '150px',
            resize: 'both',
            overflow: 'auto'
        });
        document.body.appendChild(box);
    };

    // Run after DOM is ready
    window.addEventListener('load', () => {
        setTimeout(addOverlayUI, 1000); // small delay to ensure images are loaded
    });
})();
