/**
 * This is a node script that updates the version of all the projects in the workspace.
 * It also creates a commit and a tag for the new version.
 *
 * Executing this script: node path/to/pre-publish.mjs {version}
 * or: pnpm pp {version}
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import chalk from 'chalk';
import devkit from '@nx/devkit';
const { readCachedProjectGraph } = devkit;


const args = process.argv.slice(2);
if (!args.length) {
    console.error(chalk.red('Please provide a version number as a command-line argument.'));
    process.exit(1);
}
const version = args[0];

// Make sure that the version is valid
const validVersion = /^\d+\.\d+\.\d+(-\w+\.\d+)?/;
if (!validVersion.test(version)) {
    console.error(chalk.red(`Invalid version number: ${version}`));
    process.exit(1);
}

const graph = readCachedProjectGraph();
for (const node of Object.values(graph.nodes)) {
    const prjPath = node.data?.root;
    if (prjPath) {
        const json = JSON.parse(readFileSync(prjPath + `/package.json`).toString());
        json.version = version;
        writeFileSync(prjPath + `package.json`, JSON.stringify(json, null, 2));

        console.log(chalk.green(`Updated version in ${node.name} to ${version}`));
    }
}

execSync(`git add .`);
execSync(`git commit -m "Bump version to ${version}"`);
execSync(`git tag -a v${version} -m "Version ${version}"`);
execSync(`git push --tag`);
