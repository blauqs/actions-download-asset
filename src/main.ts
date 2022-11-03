import * as core from '@actions/core'
import * as github from '@actions/github'
import axios from 'axios'
import decompress from 'decompress'
import {components} from '@octokit/openapi-types'
import {join, isAbsolute, dirname, extname} from 'path'
import {
  statSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  createWriteStream
} from 'fs'
;(async () => {
  try {
    // Define the Action Inputs
    const workspace = process.env.GITHUB_WORKSPACE || process.cwd()
    const file = core.getInput('file', {required: true})
    const repo = core.getInput('repo') || process.env.GITHUB_REPOSITORY
    const version = core.getInput('version') || 'latest'
    const prefix = core.getInput('prefix') || 'v'
    const mode = core.getInput('mode') || '644'
    const unpack =
      `${Boolean(core.getInput('unpack') || false)}`.toLowerCase() === 'true'

    // Set the GitHub Access Token... and make sure we were provided one
    const token = core.getInput('token') || process.env.GITHUB_TOKEN
    if (!token || !token.length) {
      throw new Error(
        `missing auth token, either use the 'token' input or the GITHUB_TOKEN env var`
      )
    }

    // Verify that we got the repo information from somewhere
    if (!repo || !repo.length) {
      throw new Error(
        `missing repository location, either use the 'repo' input or the GITHUB_REPOSITORY env var`
      )
    }

    // Resolve the out path
    let out = core.getInput('out')
    if (out && !isAbsolute(out)) out = join(workspace, out)
    if (out && existsSync(out) && statSync(out).isDirectory())
      out = join(out, file.replace(/[^a-z0-9_-]/gi, '').toLowerCase())
    if (!out || !out.length) out = join(workspace, file)

    // Ensure we create the directory where the file will be saved
    mkdirSync(dirname(out), {recursive: true, mode: 0o755})

    // Get an instance of GitHub Octokit
    const octokit = github.getOctokit(token || '')

    // Get repository releases
    const releases = await octokit.repos.listReleases({
      repo: repo.split('/', 2)[1],
      owner: repo.split('/', 2)[0]
    })

    // Check if repo has any releases
    if (!releases.data.length) {
      throw new Error(`no releases created in repo '${repo}'`)
    }

    // Filter the releases based on tag prefix and version
    const matchedReleases = releases.data.filter(release => {
      if (version === 'latest' && release.tag_name.startsWith(prefix)) {
        return true
      } else if (release.tag_name === prefix + version) {
        return true
      }
      return false
    })

    // Order the releases by date
    matchedReleases.sort(
      (r1, r2) => Date.parse(r1.created_at) - Date.parse(r2.created_at) == 0 ? Date.parse(r1.published_at) - Date.parse(r2.published_at) : Date.parse(r1.created_at) - Date.parse(r2.created_at)
    )

    // Ensure we found at least one release
    if (!matchedReleases.length) {
      if (version === 'latest') {
        throw new Error(
          `could not find a release with the prefix '${prefix}' in '${repo}'`
        )
      } else {
        throw new Error(
          `could not find a release with the prefix/version '${prefix}${version}' in '${repo}'`
        )
      }
    }
    
    // Construct regex
    let re;
    if (file[0] == '/' && file[file.length - 1] == '/') {
      re = new RegExp(file.substr(1, file.length - 2));
    } else {
      re = new RegExp('^' + file + '$');
    }
    
    // Filter the assets by file name
    let matchedRelease: components['schemas']['release'] | undefined
    let matchedAsset: components['schemas']['release-asset'] | undefined
    for (const release of matchedReleases) {
      for (const asset of release.assets) {
        if (re.test(asset.name)) {
          matchedAsset = asset
          matchedRelease = release
          break
        }
      }
    }

    // Ensure we found a release
    if (!matchedRelease || !matchedRelease.id) {
      throw new Error(
        `could not find a release with an asset matching the file name '${file}' in '${repo}'`
      )
    }

    // Ensure we found an asset
    if (!matchedAsset || !matchedAsset.id) {
      throw new Error(
        `could not find an asset matching the file name '${file}' in '${repo}'`
      )
    }

    // Define the matched version (in care 'latest' was used)
    const matchedVersion = matchedRelease.tag_name.replace(prefix, '')

    // Download the release asset and set file mode
    const res = await axios({
      method: 'get',
      url: matchedAsset.url,
      headers: {
        Accept: 'application/octet-stream',
        Authorization: `token ${token}`
      },
      responseType: 'stream'
    })

    // If the file already exists, delete it first
    if (existsSync(out)) unlinkSync(out)

    // Write the file to the out path
    const writer = createWriteStream(out, {mode: parseInt(mode, 8)})
    res.data.pipe(writer)

    // Wait for writer to close or error
    writer.on('close', () => {
      // Declare Action Outputs
      core.setOutput('browser_download_url', matchedAsset.browser_download_url)
      core.setOutput('out', out)
      core.setOutput('version', matchedVersion)

      // Debug info
      core.info(`downloaded ${file}@v${matchedVersion} from ${repo} to ${out}`)

      // Unpack archive if requested
      if (
        unpack &&
        ['.zip', '.tgz', '.tbz', '.gz', '.bz'].includes(extname(out))
      ) {
        // eslint-disable-next-line github/no-then
        decompress(out, dirname(out)).then(
          () => {
            // Debug info
            core.info(
              `unpacked ${file}@v${matchedVersion} into ${dirname(out)}`
            )

            // Exit successfully
            process.exit(0)
          },
          err => {
            throw new Error(`${err}`)
          }
        )
      } else {
        // Exit successfully
        process.exit(0)
      }
    })

    // Throw error if writer failed
    writer.on('error', err => {
      throw new Error(`${err}`)
    })
  } catch (error) {
    // Display helpful hints if we get back a 401
    if (error.hasOwnProperty('status') && error.status === 401) {
      core.warning(
        'looks like the provided token has no access to the repository'
      )
    }

    // Display helpful hints if we get back a 404, otherwise just display the error
    if (error.hasOwnProperty('status') && error.status === 404) {
      if (error.request.url.includes('assets')) {
        core.setFailed(
          `could not find the asset, check the spelling of the file name or the access of the auth token`
        )
      } else {
        core.setFailed(
          `could not find the repository, check the spelling of the repo or the access of the auth token`
        )
      }
    } else {
      core.setFailed(`${error}`)
    }

    process.exit(1)
  }
})()
