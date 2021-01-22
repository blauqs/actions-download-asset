#!/usr/bin/env bash

#
# Some helpful helpers
#

function errecho() {
    >&2 echo -e "\033[0;31mERR: ${*}\033[0m"
}

#
# Declare Error Codes
#

readonly ERR_GEN=1
readonly ERR_MISS_REPO=2
readonly ERR_NO_RELEASES=3
readonly ERR_NO_ASSET=4

#
# Parse Action Inputs
#

# Ensure we are given the file name
if [[ -z "${INPUT_FILE}" ]]; then
  errecho "Missing Required Input: 'file'"
  exit "${ERR_GEN}"
fi

# Resolve the owner/repo repository path
REPO="${INPUT_REPO}"
if [[ -z "${REPO}" ]]; then
  if [[ -z "${GITHUB_REPOSITORY}" ]]; then
    errecho "Missing repository location, either GitHub should provide it or the 'repo' Input"
    exit "${ERR_MISS_REPO}"
  fi
  REPO="${GITHUB_REPOSITORY}"
fi

# Optional release version
VER="${INPUT_VERSION}"
if [[ -z "${VER}" ]]; then
  VER="latest"
fi

# Optional tag prefix
PREFIX="${INPUT_PREFIX}"
if [[ -z "${PREFIX}" ]]; then
  VER="v"
fi

# Optional out directory
OUT="${INPUT_OUT}"
if [[ -d "${OUT}" ]]; then
  OUT="${OUT}/${INPUT_FILE}"
elif [[ -z "${OUT}" ]]; then
  OUT="/tmp/${INPUT_FILE}"
fi
OUT="$(echo "${OUT}" | sed -E 's|/+|/|')"

# Optional file mode
MODE="${INPUT_MODE}"
if [[ -z "${MODE}" ]]; then
  MODE="644"
fi

# Optional access token for private repositories
TOKEN="${INPUT_TOKEN}"
if [[ -z "${TOKEN}" ]]; then
  TOKEN="${GITHUB_TOKEN}"
fi

#
# Call the GitHub API and Parse Responses
#

# Define the base API URL
API_URL="https://${TOKEN}:@api.github.com/repos/${REPO}"

# Fetch all of the releases in the repository
RELEASES=$(curl -s "${API_URL}/releases")

# Ensure we found a valid repo
if [[ "$(echo "${RELEASES}" | jq -r "if type == \"object\" then .message else empty end")" == "Not Found" ]]; then
  errecho "no repository found using the location '${REPO}'"
  if [[ -z "${TOKEN}" ]]; then
    errecho "no token was provided, this could be the reason for not finding the repository"
  fi
  exit "${ERR_MISS_REPO}"
fi

# Ensure we got a list of releases
if [[ "$(echo "${RELEASES}" | jq -r "length")" -eq 0 ]]; then
  errecho "no releases created in repo '${REPO}'"
  exit "${ERR_NO_RELEASES}"
fi

# Choose the release, based on tag prefix and version
CHOSEN_RELEASE=
if [[ "${VER}" == "latest" ]]; then
  FILTERED_RELEASES=$(echo "${RELEASES}" | jq -r "map(select(.tag_name | startswith(\"${PREFIX}\")))")
  if [[ "$(echo "${FILTERED_RELEASES}" | jq -r "length")" -eq 0 ]]; then
    errecho "could not find a release with the prefix '${PREFIX}'"
    exit "${ERR_NO_RELEASES}"
  fi

  CHOSEN_RELEASE=$(echo "${FILTERED_RELEASES}" | jq -r ".[0]")
  if [[ -z "${CHOSEN_RELEASE}" || "${CHOSEN_RELEASE}" == "null" ]]; then
    errecho "could not find a release with the prefix '${PREFIX}'"
    exit "${ERR_NO_RELEASES}"
  fi
else
  FILTERED_RELEASES=$(echo "${RELEASES}" | jq -r "map(select(.tag_name == \"${PREFIX}${VER}\"))")
  if [[ "$(echo "${FILTERED_RELEASES}" | jq -r "length")" -eq 0 ]]; then
    errecho "could not find a release with the prefix/version '${PREFIX}${VER}'"
    exit "${ERR_NO_RELEASES}"
  fi

  CHOSEN_RELEASE=$(echo "${FILTERED_RELEASES}" | jq -r ".[0]")
  if [[ -z "${CHOSEN_RELEASE}" || "${CHOSEN_RELEASE}" == "null" ]]; then
    errecho "could not find a release with the prefix/version '${PREFIX}${VER}'"
    exit "${ERR_NO_RELEASES}"
  fi
fi

# Choose the release asset, based on the given file name
ASSET=$(echo "${CHOSEN_RELEASE}" | jq -r ".assets | map(select(.name == \"${INPUT_FILE}\"))")
if [[ "$(echo "${ASSET}" | jq -r "length")" -eq 0 ]]; then
  errecho "could not find an asset with the file name '${INPUT_FILE}'"
  exit "${ERR_NO_ASSET}"
fi

ASSET_ID=$(echo "${ASSET}" | jq -r ".[0] | .id")
if [[ -z "${ASSET_ID}" ]]; then
  errecho "could not get the asset id with the file name '${INPUT_FILE}'"
  exit "${ERR_NO_ASSET}"
fi

# Get the release tag name, in case the "latest" version was used
TAG_VERSION=$(echo "${CHOSEN_RELEASE}" | jq -r ".tag_name" | awk -F'/' '{ print $NF }' | sed -e "s/^v//" | sed -e "s/^v.//")

#
# Download the resolved Asset ID from GitHub Release
#

curl \
  -s \
  -J \
  -L \
  -H "Accept: application/octet-stream" \
  -o "${OUT}" \
  "${API_URL}/releases/assets/${ASSET_ID}"

# Apply the file mode
chmod "${MODE}" "${OUT}"

#
# Declare the Workflow Outputs
#

echo "##[set-output name=out;]${OUT}"
echo "##[set-output name=version;]${TAG_VERSION}"
