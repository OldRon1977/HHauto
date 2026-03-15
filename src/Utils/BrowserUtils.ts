/**
 * Browser detection utilities.
 *
 * Parses the browser's User-Agent string to identify the browser name and
 * version. Used primarily by the debug log exporter (saveHHDebugLog) so
 * that bug reports include the user's browser environment.
 */

/**
 * Detect the browser name and full version from the given Navigator object.
 *
 * Handles Chrome, Firefox, Safari, Opera (OPR), Edge, and IE/Trident.
 * Returns a human-readable string like "chrome 120.0.6099.130".
 *
 * @param nav - The Navigator object (typically `window.navigator`).
 * @returns A string in the format "<browser> <version>".
 */
export function getBrowserData(nav: Navigator) {
    let name:string, version;

    var ua = nav.userAgent;
    var browserMatch = ua.match(/(opera|chrome|safari|firefox|Edg|msie|trident(?=\/))\/?\s*([\d\.]+)/i) || [];
    if (browserMatch[1]) { browserMatch[1] = browserMatch[1].toLowerCase(); }
    var operaMatch;
    if (browserMatch[1] === 'chrome') { operaMatch = ua.match(/\bOPR\/([\d\.]+)/); }

    if (/trident/i.test(browserMatch[1])) {
        var msieMatch = /\brv[ :]+([\d\.]+)/g.exec(ua) || [];
        name = 'msie';
        version = msieMatch[1];
    }
    else if (operaMatch) {
        name = 'opera';
        version = operaMatch[1];
    }
    else if (browserMatch[1] === 'safari') {
        var safariVersionMatch = ua.match(/version\/([\d\.]+)/i);
        name = 'safari';
        version = safariVersionMatch[1];
    }
    else {
        name = browserMatch[1];
        version = browserMatch[2];
    }

    var versionParts = [];
    if (version) {
        var versionPartsMatch = version.match(/(\d+)/g) || [];
        for (var i=0; i < versionPartsMatch.length; i++) {
            versionParts.push(versionPartsMatch[i]);
        }
        //if (versionParts.length > 0) { data.majorVersion = versionParts[0]; }
    }
    name = name || '(unknown browser name)';
    version = {
        full: version || '(unknown full browser version)',
        parts: versionParts,
        major: versionParts.length > 0 ? versionParts[0] : '(unknown major browser version)'
    };

    return name + ' ' + version['full'];
};