(function () {
    'use strict';

    function detectHeadless() {
        const ua = (navigator.userAgent || '').toLowerCase();

        // 1. Navigator webdriver flag (raw Puppeteer / ChromeDriver / Selenium)
        if (navigator.webdriver === true) {
            return 'navigator.webdriver';
        }

        // 2. User-Agent based indicators
        const uaIndicators = ['headlesschrome', 'chromedriver', 'selenium', 'webdriver', 'phantomjs', 'headless'];
        for (const indicator of uaIndicators) {
            if (ua.includes(indicator)) {
                return `user-agent:${indicator}`;
            }
        }

        // 3. Window globals left by automation frameworks
        const winProps = [
            'callPhantom',
            '_phantom',
            '__nightmare',
            'selenium',
            '__webdriver_script_fn',
            'domAutomation',
            'domAutomationController',
            'cdc_adoQpoasnfa76pfcZLmcfl_',
            'cdc_adoQpoasnfa76pfcZLmcfl_Array',
            'cdc_adoQpoasnfa76pfcZLmcfl_Promise',
            'cdc_adoQpoasnfa76pfcZLmcfl_Symbol',
        ];
        for (const prop of winProps) {
            if (Object.prototype.hasOwnProperty.call(window, prop)) {
                return `window.${prop}`;
            }
        }

        // 4. Plugins / MimeTypes prototype check (raw headless often has plain Object)
        try {
            if (navigator.plugins && navigator.plugins.constructor.name !== 'PluginArray') {
                return 'plugins.constructor';
            }
            if (navigator.mimeTypes && navigator.mimeTypes.constructor.name !== 'MimeTypeArray') {
                return 'mimeTypes.constructor';
            }
        } catch (e) {
            // ignore
        }

        // 5. Chrome-only runtime check (very rough)
        const isChrome = /chrome/.test(ua) && !/edg|opr|opera/.test(ua);
        if (isChrome && !window.chrome) {
            return 'missing-window.chrome';
        }

        return null;
    }

    const reason = detectHeadless();
    window.__botDetected = reason;

    if (reason) {
        console.warn('[bot-detect] Headless/automation detected:', reason);
    }
})();
