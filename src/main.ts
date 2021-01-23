import * as core from '@actions/core'
import * as github from '@actions/github'
import {components} from '@octokit/openapi-types'
import {join, isAbsolute, resolve, dirname} from 'path'
import {
  statSync,
  existsSync,
  mkdirSync,
  unlinkSync,
  createWriteStream
} from 'fs'
import {get} from 'https'
;(async () => {
  try {
    // Define GitHub env constants
    const ghVolumes = [
      '/github/home',
      '/github/workflow',
      '/github/workspace',
      '/github/file_commands'
    ]

    // Define the Action Inputs
    const workspace = '/github/workspace'
    const file = core.getInput('file', {required: true})
    const repo = core.getInput('repo') || process.env.GITHUB_REPOSITORY
    const version = core.getInput('version') || 'latest'
    const prefix = core.getInput('prefix') || 'v'
    const mode = core.getInput('mode') || '644'

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
      out = join(out, file)
    if (!out || !out.length) out = join(workspace, file)

    // Check to see if out path is in the GitHub Volumes, otherwise warn the user
    let outFound = 0
    for (const vol of ghVolumes) {
      if (out.startsWith(vol)) {
        outFound++
        break
      }
    }
    if (!outFound) {
      core.warning(`you're writing the file to an inaccessible directory...`)
      core.warning(
        `only these directories are mounted by GitHub: [${ghVolumes.join(
          ', '
        )}]`
      )
    }

    // Ensure we create the directory where the file will be saved
    mkdirSync(dirname(out), {recursive: true})

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

    // Filter the assets by file name
    let matchedRelease: components['schemas']['release'] | undefined
    let matchedAsset: components['schemas']['release-asset'] | undefined
    for (const release of matchedReleases) {
      for (const asset of release.assets) {
        if (asset.name === file) {
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
    get(
      matchedAsset.browser_download_url,
      {
        headers: {
          Accept: 'application/octet-stream',
          Authorization: `token ${token}`
        }
      },
      res => {
        // If the file already exists, delete it first
        if (existsSync(out)) unlinkSync(out)

        // Write the file to the out path
        res.pipe(createWriteStream(out, {mode: parseInt(mode)}))

        // Declare Action Outputs
        core.setOutput('out', out)
        core.setOutput('version', matchedVersion)

        process.exit(0)
      }
    )
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
