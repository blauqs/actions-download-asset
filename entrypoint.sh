#!/usr/bin/env bash

# Ensure we are given the file name
if [[ -z "${INPUT_FILE}" ]]; then
  echo "Missing Required Input: 'file'"
  exit 1
fi

# Resolve the repo owner/name path
REPO=
if [[ -z "${INPUT_REPO}" ]]; then
  if [[ -z "${GITHUB_REPOSITORY}" ]]; then
    echo "Missing GITHUB_REPOSITORY env variable, should be provided by GitHub"
    exit 2
  fi
  REPO="${GITHUB_REPOSITORY}"
else
  REPO="${INPUT_REPO}"
fi

# Optional access token for private repositories
TOKEN="${GITHUB_TOKEN}"
if [[ -n "${INPUT_TOKEN}" ]]; then
  TOKEN="${INPUT_TOKEN}"
fi

# Define useful variables to be reused
API_URL="https://${TOKEN}:@api.github.com/repos/${REPO}"
RELEASES=$(curl "${API_URL}/releases")
CHOSEN_RELEASE=$(echo "${RELEASES}" | jq -r ".[] | select(.tag_name | startswith(\"${INPUT_PREFIX}\"))")
ASSET_ID=$(echo "${CHOSEN_RELEASE}" | jq -r ".assets | map(select(.name == \"${INPUT_FILE}\"))[0].id")
TAG_VERSION=$(echo "${CHOSEN_RELEASE}" | jq -r ".tag_name" | awk -F'/' '{ print $NF }' | sed -e "s/^v//" | sed -e "s/^v.//")
OUT_DIR="${INPUT_OUT:-/tmp}"
OUT_DIR="$(echo "${OUT_DIR}" | sed -E 's/\/+$//')"

# Fail if we couldn't find a release
if [[ -z "${ASSET_ID}" ]]; then
  echo "Could not find asset id"
  exit 3
fi

# Download the asset file
curl \
  -s \
  -J \
  -L \
  -H "Accept: application/octet-stream" \
  "${API_URL}/releases/assets/${ASSET_ID}" \
  -o "${OUT_DIR}/${INPUT_FILE}"

# Declare the output values for Workflow to read
echo "##[set-output name=out;]${OUT_DIR}/${INPUT_FILE}"
echo "##[set-output name=version;]${TAG_VERSION}"
