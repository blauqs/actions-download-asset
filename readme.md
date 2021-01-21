# Download GitHub Release Asset

This action downloads an asset from a Github release. Supports private repositories as well as monorepos with path prefixes to their tags, i.e. `lib/log/v` will only match releases with that prefix.

## Inputs

### `repo`

The 'owner/repo' of the repository to download from, i.e. `blauqs/test`

### `version`

The version of the release to download from (defaults to `latest`)

### `prefix`

The tag prefix to use, useful in monorepos with path prefix for tags (defaults to `v`)

### `file`

**Required** The name of the file in the release to download

### `out`

The directory where the file will be stored on local disk (defaults to `/tmp/`)

### `token`
An optional Access Token to access repository. You need to either specify this or use the ``secrets.GITHUB_TOKEN`` environment variable. Note that if you are working with a private repository, you cannot use the default ``secrets.GITHUB_TOKEN`` - you have to set up a [personal access token with at least the scope org:hook](https://github.com/dsaltares/fetch-gh-release-asset/issues/10#issuecomment-668665447).

## Outputs

### `out`

The location on local disk where the file was stored

### `version`

The version of the release or tag

## Usage Example

```yaml
uses: blauqs/action-download-asset@master
id: download
with:
  repo: blauqs/test
  version: latest
  file: some-foo-file.zip
  out: /usr/local/src/
  token: ${{ secrets.YOUR_TOKEN }}
```
