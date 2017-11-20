#!/usr/bin/env node

import * as Table from 'cli-table';
import 'colors';
import {version} from 'commander';
import {readFile} from 'fs';
import {prompt, registerPrompt} from 'inquirer';
import * as autoComplete from 'inquirer-autocomplete-prompt';
import {Observable} from 'rxjs';
import {exec} from 'shelljs';
import {promisify} from 'util';
import {Git, Log} from './git';
import {error, info, message, notice, warn} from './ui';

class Main {

  args;
  branchBookmark: string;
  config: { before: string[], after: string[] };
  git = new Git();
  masterGitHash: string;
  masterPackage: any;
  sourceCommit: Log;
  sourcePackage: any;
  rf = promisify(readFile);

  constructor() {
    registerPrompt('autocomplete', autoComplete);
  }

  async start() {
    try {
      notice(`Merge to Master, (c) 2017 Jean-Pierre E. Poveda`);

      this.branchBookmark = this.git.getCurrentBranch();
      this.args = await this.buildArgs();

      if (this.git.hasUncommittedChanges() && !this.args.skipUncommittedChanges) {
        error('...uncommitted changes...');
      }

      this.sourceCommit = await this.getTargetCommit();

      this.git.checkout(this.sourceCommit.hash);

      await this.getConfig(this.args);

      this.masterGitHash = this.git.getBranchHash('master');
      await this.verifyCommits();

      const cpkg: any = this.git.getFile('package.json', this.sourceCommit.hash)
        || error(`'${this.sourceCommit.hash}, branch:[${this.sourceCommit.branch}]' package.json is missing`);

      let mpkg: any = this.git.getFile('package.json', 'master');

      if (!mpkg && this.args.skipMatchingVersions) {
        notice(`'master' branch 'package.json' is missing`);
        mpkg = '{"version":"not defined"}';
      } else if (!mpkg) {
        error(`'master' branch 'package.json' is missing`);
      }

      this.sourcePackage = this.loadPackageJson(cpkg, this.sourceCommit.hash);
      this.masterPackage = this.loadPackageJson(mpkg, 'master');
      await this.verifyPackageVersions();

      await this.run();

    } catch (err) {
      console.log('Unexpected error:'.red);
      console.log(`${err}`.red);
    }
  }

  private async buildArgs() {
    const pkg = JSON.parse(await this.rf('./package.json', 'utf8'));

    const args = version(pkg.version)
      .option('-c, --config <file ...>', 'Configuration file for procedures')
      .option('--skipMatchingCommits', 'Will not check to see if commits on branch matches master')
      .option('--skipMatchingVersions', 'Will not check to see if version of package.json on branch matches master')
      .option('--skipUncommittedChanges', 'Will not check to see if there are uncommitted changes');

    args.on('--help', this.help);

    args.parse(process.argv);

    return args;
  }

  private async doMerge() {
    this.git.checkout('master');
    this.git.merge(this.sourceCommit, this.sourcePackage.version);

    const lastLog = this.git.getLogs(1)[0];
    this.git.tag(lastLog, this.sourcePackage.version);

    const answers = await prompt({
      default: false,
      message: `Push commit with tags to origin`,
      name: 'confirm',
      type: 'confirm'
    });

    if (!answers.confirm) {
      this.git.checkout(this.branchBookmark);
      return;
    }

    this.git.pushToOrigin();
    this.git.checkout(this.branchBookmark);
  }

  private async doScript(script: string) {
    const ex = promisify(exec);
    const cmd = script.startsWith('.')
      ? `${script} --source ${this.sourceCommit.hash} --target 'master'`
      : script;

    try {
      notice(`starting ${script}`);
      const result: any = await exec(cmd);

      const resultMsg = `${script} returned ${result.code}`;
      if (result.code === 0) {
        info(`✔ ${resultMsg}`);
      } else {
        error(`⛔  ${resultMsg}`);
      }
    } catch (err) {
      error(`unexpected error running script ${script}: ${err}`);
    }
  }

  private async getConfig(args) {
    try {
      const configFile = args.config || '.m2m';
      this.config = JSON.parse(await this.rf(configFile, 'utf8'));

      if (!this.config || typeof this.config !== 'object') {
        error(`${configFile} before is malformed.`);
      }

      if (!Array.isArray(this.config.before) || this.config.before.some((val) => typeof val !== 'string')) {
        error(`${configFile} before is malformed.`);
      }

      if (this.config.after && (!Array.isArray(this.config.after) || this.config.after.some((val) => typeof val !== 'string'))) {
        error(`${configFile} after is malformed.`);
      }
    } catch (err) {
      error(`Unable to parse config file '${args.config || '.m2m'}', ${err}`);
    }
  }

  private async getTargetCommit() {
    const answers = await prompt({
      type: 'autocomplete',
      name: 'commit',
      message: 'Select the commit you want to merge to master:',
      source: this.filterCommits.bind(this)
    } as any);

    return await this.git.getLog(answers.commit.substr(0, answers.commit.indexOf(' ')));
  }

  private async filterCommits(answers, input) {
    return Observable
      .from(this.git.getLogs())
      .filter((log) => log.matches(input))
      .map((log) => (log.branch)
        ? `${log.hash} [${log.branch}] ${log.committer}, ${log.subject.substring(0, 80)}`
        : `${log.hash} ${log.committer}, ${log.subject.substring(0, 80)}`
      )
      .toArray()
      .toPromise();
  }

  private async help() {
    message('');
    message('Merge to Master (m2m) is a utility to procedurally merge to master. It looks for a', 2);
    message('.m2m file that has an array of paths pointing to executable scripts that must each', 2);
    message('exit 0 in order to continue.', 2);
    message('');
  }

  private loadPackageJson(text: string, commit: string) {
    try {
      return JSON.parse(text);
    } catch (err) {
      error(`Problem with parsing ${commit} 'package.json', ${err}`);
    }
  }

  private async run() {
    for (const script of this.config.before) {
      await this.doScript(script);
    }

    this.doMerge();

    if (this.config.after) {
      for (const script of this.config.after) {
        await this.doScript(script);
      }
    }
  }

  private async verifyCommits() {
    if (!this.args.skipMatchingCommits && this.sourceCommit.hash === this.git.getBranchHash('master')) {
      const answers = await prompt({
        default: false,
        message: `'master (${this.masterGitHash})' and '${this.sourceCommit.hash}' are the same commit, continue?`,
        name: 'confirm',
        type: 'confirm'
      });

      if (!answers.confirm) {
        error(`'master (${this.masterGitHash})' and '${this.sourceCommit.hash}' are the same commit`);
      }
    } else {
      const msg = `source (${this.sourceCommit.hash}) -> target 'master' (${this.masterGitHash})`;
      this.sourceCommit.hash === this.git.getBranchHash('master')
        ? warn(msg)
        : info(msg);
    }
  }

  private async verifyPackageVersions() {
    if (!this.args.skipMatchingVersions && this.sourcePackage.version === this.masterPackage.version) {
      const answers = await prompt({
        default: false,
        message: `master and ${this.sourceCommit.hash} have the same package.json version number ${this.sourcePackage.version}, continue?`,
        name: 'confirm',
        type: 'confirm'
      });

      if (!answers.confirm) {
        error(`master and ${this.sourceCommit.hash} have the same package.json version number ${this.sourcePackage.version}`);
      }
    } else {
      const table = new Table({
        head: ['git', 'package.json version']
      });

      const color = this.sourcePackage.version === this.masterPackage.version
        ? 'yellow'
        : 'green';

      table.push(
        [this.sourceCommit.hash[color], this.sourcePackage.version[color]],
        ['master'[color], this.masterPackage.version[color]]
      );

      console.log(table.toString());
    }
  }
}

new Main().start();
