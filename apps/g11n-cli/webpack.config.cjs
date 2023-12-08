const { composePlugins, withNx } = require('@nx/webpack');
const TransformJson = require('transform-json-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const WriteToFilePlugin = require('write-to-file-webpack');

// Nx plugins for webpack.
module.exports = composePlugins(withNx(), (config) => {

    config.plugins.push(new TransformJson({
        filename: 'package.json',
        source: __dirname + "/package.json",
        object: {
            main: "./main.js",
            type: "commonjs",
            publishConfig: undefined
        }
    }));

    config.plugins.push(new CopyWebpackPlugin({
        patterns: [
            { from: 'bin', to: 'bin' },
            { from: 'README.md', to: 'README.md' },
            { from: '../../LICENSE', to: '.' }
        ]
    }));

    config.plugins.push(new WriteToFilePlugin({
        filename: __dirname + '/dist/.npmignore',
        data: 'main.js.map\n'
    }));

    return config;
});
