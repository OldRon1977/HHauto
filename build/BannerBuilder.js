const fs = require('fs')
const path = require('path')
const pkgJson = require('../package.json')

// Menu typeface (#1834). The font travels inside the script as a data URI
// rather than as a link to a font host: the script runs in the game page, so
// an external stylesheet would put a third-party request on every page load
// and would be dropped outright if a game domain ever sets a font-src CSP.
// See build/fonts/README.md for why the file is passed through unmodified.
const FONT_FILE = 'IBMPlexSans-latin.woff2'

class BannerBuilder {
    static buildBanner() {
        const metaTemplate = fs.readFileSync(path.resolve(__dirname, './HHAuto.template.js'))
        const font = fs.readFileSync(path.resolve(__dirname, 'fonts', FONT_FILE)).toString('base64')
        const meta = metaTemplate.toString()
                .replace('{{version}}', pkgJson.version)
                .replace('{{menuFontBase64}}', font)
        return meta;
    }
}

module.exports = BannerBuilder
