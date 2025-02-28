/**
 * This is a node script that updates the version of all the projects in the
 * workspace. It also creates a commit and a tag for the new version.
 *
 * To set all versions to a particular number:
 *
 *      node path/to/pre-publish.mjs {version}
 *      pnpm pp {version}
 *
 * To increment the patch version:
 *
 *      node path/to/pre-publish.mjs
 *      pnpm pp
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import chalk from 'chalk';
import devkit from '@nx/devkit';
const { readCachedProjectGraph } = devkit;

const validVersion = /^(\d+)\.(\d+)\.(\d+)$/;


const args = process.argv.slice(2);
let version = '';
if (args.length) {
    // Make sure that the version is valid
    if (!validVersion.test(version)) {
        console.error(chalk.red(`Invalid version number: ${version}`));
        process.exit(1);
    }
    version = args[0];
}


const graph = readCachedProjectGraph();
for (const node of Object.values(graph.nodes)) {
    const prjPath = node.data?.root;
    if (prjPath) {
        const json = JSON.parse(readFileSync(prjPath + `/package.json`).toString());

        if (version !== '') {
            json.version = version;
        } else {
            const prevVersion = json.version;
            const match = validVersion.exec(prevVersion);
            const major = parseInt(match[1]);
            const minor = parseInt(match[2]);
            const patch = parseInt(match[3]);
            json.version = `${major}.${minor}.${patch + 1}`;
        }
        writeFileSync(prjPath + `package.json`, JSON.stringify(json, null, 2));
        console.log(chalk.green(`Updated version in ${node.name} to ${json.version}`));
    }
}

execSync(`git add .`);
execSync(`git commit -m "Bump version to ${version}"`);
execSync(`git tag -a v${version} -m "Version ${version}"`);
execSync(`git push --tag`);
