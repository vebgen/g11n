// https://github.com/nrwl/nx/blob/master/packages/react/plugins/bundle-rollup.ts

const rollup = require('rollup');
const terser = require('@rollup/plugin-terser');

function getRollupOptions(options) {
    const extraGlobals = {
        react: 'React',
        'react-dom': 'ReactDOM',
        'styled-components': 'styled',
        '@emotion/react': 'emotionReact',
        '@emotion/styled': 'emotionStyled',
    };

    if (Array.isArray(options.output)) {
        options.output.forEach((o) => {
            o.globals = { ...o.globals, ...extraGlobals };
        });
    } else {
        options.output = {
            ...options.output,
            globals: {
                ...options.output.globals,
                ...extraGlobals,
            },
        };
    }
    options.plugins = [
        ...options.plugins,
        terser(),
    ];
    // console.log("options %O", options);
    // options.plugins.filter(o => o.name === 'peer-deps-external').forEach(o => {
    //     console.log("peer-deps-external %O", o.options);
    // });
    return options;
}

module.exports = getRollupOptions;
