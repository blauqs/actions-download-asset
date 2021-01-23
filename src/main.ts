import * as core from '@actions/core';
import * as github from '@actions/github';
import { components } from '@octokit/openapi-types';
import { join, isAbsolute, resolve, dirname } from 'path';
import { statSync, mkdirSync, createWriteStream } from 'fs';
import * as stream from "stream";

(async() => {
    let token: string;
    try {
        // Define GitHub env constants
        const ghVolumes = [
            '/github/home',
            '/github/workflow',
            '/github/workspace',
            '/github/file_commands',
        ];

        // Define the Action Inputs
        const workspace = '/github/workspace';
        const file = core.getInput('file', { required: true });
        const repo = core.getInput('repo') || process.env.GITHUB_REPOSITORY;
        const version = core.getInput('version') || 'latest';
        const prefix = core.getInput('prefix') || 'v';
        const mode = core.getInput('mode') || '644';

        // Set the GitHub Access Token...
        token = core.getInput('token') || process.env.GITHUB_TOKEN;

        // Verify that we got the repo information from somewhere
        if (!repo.length) {
            throw new Error(`missing repository location, either GitHub should provide it or the 'repo' input`);
        }

        // Resolve the out path
        let out = core.getInput('out') || join(workspace, file);
        if (!isAbsolute(out)) out = join(workspace, out);
        if (statSync(out).isDirectory()) out = join(out, file);
        out = resolve(out);

        // Check to see if out path is in the GitHub Volumes, otherwise warn the user
        let outFound = 0;
        for (const vol of ghVolumes) {
            if (out.startsWith(vol)) {
                outFound++;
                break;
            }
        }
        if (!outFound) {
            core.warning(`you're writing the file to an inaccessible directory...`);
            core.warning(`only these directories are mounted by GitHub: [${ghVolumes.join(', ')}]`);
        }

        // Ensure we create the directory where the file will be saved
        mkdirSync(dirname(out), { recursive: true })

        // Get an instance of GitHub Octokit
        const octokit = github.getOctokit(token)

        // Get repository releases
        const releases = await octokit.repos.listReleases();

        // Check if repo has any releases
        if (!releases.data.length) {
            throw new Error(`no releases created in repo '${repo}'`);
        }

        // Filter the releases based on tag prefix and version
        const matchedReleases = releases.data.filter(release => {
            if (version === 'latest' && release.tag_name.startsWith(prefix)) {
                return true;
            } else if (release.tag_name === prefix+version) {
                return true;
            }
            return false;
        })

        // Ensure we found at least one release
        if (!matchedReleases.length) {
            if (version === 'latest') {
                throw new Error(`could not find a release with the prefix '${prefix}' in '${repo}'`);
            } else {
                throw new Error(`could not find a release with the prefix/version '${prefix}${version}' in '${repo}'`);
            }
        }

        // Filter the assets by file name
        let matchedRelease: components['schemas']['release'];
        let matchedAsset: components['schemas']['release-asset'];
        for (const release of matchedReleases) {
            for (const asset of release.assets) {
                if (asset.name === file) {
                    matchedAsset = asset;
                    matchedRelease = release;
                    break;
                }
            }
        }

        // Define the matched version (in care 'latest' was used)
        const matchedVersion = matchedRelease.tag_name.replace(prefix, '')

        // Ensure we found an asset
        if (!matchedAsset.id) {
            throw new Error(`could not find an asset with the file name '${file}' in '${repo}'`);
        }

        // Download the release asset and set file mode
        octokit.repos.getReleaseAsset({
            repo: repo.split('/', 2)[1],
            owner: repo.split('/', 2)[0],
            asset_id: matchedAsset.id,
            headers: {
                Accept: 'application/octet-stream',
                Authorization: 'token '+token,
            }
        }).then(res => {
            (res.data as unknown as stream).pipe(createWriteStream(out, { mode: parseInt(mode) }));
        })

        // Display confirmation
        core.info(`Successfully wrote file to ${out}.`)
        core.info(`out=${out}`);
        core.info(`version=${matchedVersion}`);

        // Declare Action Outputs
        core.setOutput('out', out);
        core.setOutput('version', matchedVersion);

        process.exit(0);
    } catch (error) {
        if (!token.length) {
            core.warning('no token was provided, this could be the reason for not finding the repository');
        } else {
            core.warning('by the way, GitHub will return 404 Not Found when the provided token has no access to the repository');
        }
        core.setFailed(`${error}`);
        process.exit(1);
    }
})();
