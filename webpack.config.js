/* eslint-env node */
const path = require('path')
const webpack = require('webpack')
// const UglifyJsPlugin = require('uglifyjs-webpack-plugin')
const TerserPlugin = require("terser-webpack-plugin");
const BannerBuilder = require('./build/BannerBuilder')

const bannerBuiled = BannerBuilder.buildBanner();

module.exports = {
    mode: 'production',
    entry: './src/index.ts',
    output: {
        filename: './HHAuto.user.js',
        path: path.resolve(__dirname, '.'),
    },
    resolve: {
        extensions: ["", ".webpack.js", ".web.js", ".ts", ".tsx", ".js", ".jsx"],
    },
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                use: ['babel-loader'],
              },
          // All files with a '.ts' or '.tsx' extension will be handled by 'ts-loader'.
          { test: /\.tsx?$/, loader: "ts-loader" },
          // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
          { test: /\.js$/, loader: "source-map-loader" },
        ],
    },
    optimization: {
        minimize: false,
        minimizer: [new TerserPlugin({
            terserOptions: {
                output: {
                  preamble: bannerBuiled,
                  comments: false
                }
              }
        })],
    },
    performance: {
        hints: false,
    },
    plugins: [
        new webpack.BannerPlugin({
            banner: bannerBuiled,
            raw: true,
            entryOnly: true
        })
    ]
}
