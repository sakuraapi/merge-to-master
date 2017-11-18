import {exec} from 'shelljs';

export class Branch {

    hash: string;
    isCurrent = false;
    message: string;
    name: string;
    remote: string;

    constructor(raw: string) {
        if (raw.startsWith('*')) {
            this.isCurrent = true;
            raw = raw.substring(1);
        }
        raw = raw.trim();

        let i = raw.indexOf(' ');
        this.name = raw.substr(0, i);
        raw = raw.substring(i, raw.length).trim();

        i = raw.indexOf(' ');
        this.hash = raw.substring(0, i);
        raw = raw.substring(i, raw.length).trim();

        i = raw.indexOf(' ');
        this.remote = raw.substring(0, i).replace('[', '').replace(']', '');
        raw = raw.substring(i, raw.length).trim();

        this.message = raw;
    }
}

export class Git {
    get currentBranch(): string {
        return (exec('git rev-parse --abbrev-ref HEAD', {silent: true}).stdout as string).trim();
    }

    currentBranchMatches(branchName: string) {
        return this.getHash(this.currentBranch) === this.getHash(branchName);
    }

    getBranches(): Branch[] {
        const branches = (exec('git branch -vv', {silent: true}).stdout as string)
            .split('\n')
            .filter((val) => val !== '');

        const result = [];
        for (const branch of branches) {
            result.push(new Branch(branch));
        }

        return result;
    }

    getHash(branchName: string): string {
        const branches = this.getBranches();
        for (const branch of branches) {
            if (branch.name === branchName) {
                return branch.hash;
            }
        }
        return null;
    }

    getFile(file: string, commit?: string): string {
        commit = commit || 'HEAD';

        return (exec(`git show ${commit}:./${file}`, {silent: true}).stdout as string).trim();
    }
}


