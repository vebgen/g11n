#! /usr/bin/env node

// This file is used to generate executables on the platform it is
// installed to.
// As we create commonjs modules, we need to use the require function
// to import the main module.
// In the `dist` folder we generate the main.js in the root, at same level
// as the bin folder.

require('../main.js');
