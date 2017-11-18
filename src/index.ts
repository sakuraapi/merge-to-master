#!/usr/bin/env node
import 'colors';
import {version} from 'commander';
import {readFile} from 'fs';
import {prompt} from 'inquirer';
import {promisify} from 'util';
import {Git} from './git';
import {error, info, message, notice, warn} from './ui';

main();

async function main() {
    const git = new Git();
    const rf = promisify(readFile);

    try {
        const currentBranch = git.currentBranch;

        notice(`Merge to Master, (c) 2017 Jean-Pierre E. Poveda`);
        warn(`Current branch is: ${currentBranch.rainbow}`);

        const args = await buildArgs();

        const configFile = args.config || '.m2m';
        const config = JSON.parse(await rf(configFile, 'utf8'));

        if (!Array.isArray(config) || config.some((val) => typeof val !== 'string')) {
            error(`${configFile} should be an array of strings pointing to scripts that return 0 on success and > 0 on failure`);
            process.exit(1);
        }

        if (!args.skipMatchingCommits && git.currentBranchMatches('master')) {
            const answers = await prompt({
                default: false,
                message: `'master' and '${currentBranch}' are both on commit ${git.getHash('master')}, continue?`,
                name: 'confirm',
                type: 'confirm'
            });

            if (!answers.confirm) {
                error(`'master' and '${currentBranch}' are both on commit ${git.getHash('master')}`);
            }
        }

        const cpkg = git.getFile('package.json');
        const mpkg = git.getFile('package.json', 'master');

        if (!cpkg) {
            error(`'${currentBranch}' branch 'package.json' is missing`);
        }

        if (!mpkg) {
            error(`'master' branch 'package.json' is missing`);
        }

        const currentPackage = JSON.parse(cpkg);
        const masterPackage = JSON.parse(mpkg);

        info(`'package.json' version on '${currentBranch}': '${currentPackage.version}'`);
        info(`'package.json' version on 'master': '${masterPackage.version}'`);

        if (!args.skipMatchingVersions && currentPackage.version === masterPackage.version) {
            const answers = await prompt({
                default: false,
                message: `'master' and '${currentBranch}' both have the same version number ${currentPackage.version}, continue?`,
                name: 'confirm',
                type: 'confirm'
            });

            if (!answers.confirm) {
                error(`'master' and '${currentBranch}' both have the same version number ${currentPackage.version}`);
            }
        }

    } catch (err) {
        console.log('Unexpected error:'.red);
        console.log(`${err}`.red);
    }
}

async function buildArgs() {
    const rf = promisify(readFile);
    const pkg = JSON.parse(await rf('./package.json', 'utf8'));

    const args = version(pkg.version)
        .option('-c, --config <file ...>', 'Configuration file for procedures')
        .option('--skipMatchingCommits', 'Will not check to see if commits on branch matches master')
        .option('--skipMatchingVersions', 'Will not check to see if version of package.json on branch matches master');

    args.on('--help', help);

    args.parse(process.argv);

    return args;
}

function help() {
    message('');
    message('Merge to Master (m2m) is a utility to procedurally merge to master. It looks for a', 2);
    message('.m2m file that has an array of paths pointing to executable scripts that must each', 2);
    message('exit 0 in order to continue.', 2);
    message('');
}
