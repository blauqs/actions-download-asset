"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var core = require("@actions/core");
var github = require("@actions/github");
var path_1 = require("path");
var fs_1 = require("fs");
(function () { return __awaiter(void 0, void 0, void 0, function () {
    var token, ghVolumes, workspace, file, repo, version_1, prefix_1, mode_1, out_1, outFound, _i, ghVolumes_1, vol, octokit, releases, matchedReleases, matchedRelease, matchedAsset, _a, matchedReleases_1, release, _b, _c, asset, matchedVersion, error_1;
    return __generator(this, function (_d) {
        switch (_d.label) {
            case 0:
                _d.trys.push([0, 2, , 3]);
                ghVolumes = [
                    '/github/home',
                    '/github/workflow',
                    '/github/workspace',
                    '/github/file_commands',
                ];
                workspace = '/github/workspace';
                file = core.getInput('file', { required: true });
                repo = core.getInput('repo') || process.env.GITHUB_REPOSITORY;
                version_1 = core.getInput('version') || 'latest';
                prefix_1 = core.getInput('prefix') || 'v';
                mode_1 = core.getInput('mode') || '644';
                // Set the GitHub Access Token...
                token = core.getInput('token') || process.env.GITHUB_TOKEN;
                // Verify that we got the repo information from somewhere
                if (!repo.length) {
                    throw new Error("missing repository location, either GitHub should provide it or the 'repo' input");
                }
                out_1 = core.getInput('out') || path_1.join(workspace, file);
                if (!path_1.isAbsolute(out_1))
                    out_1 = path_1.join(workspace, out_1);
                if (fs_1.statSync(out_1).isDirectory())
                    out_1 = path_1.join(out_1, file);
                out_1 = path_1.resolve(out_1);
                outFound = 0;
                for (_i = 0, ghVolumes_1 = ghVolumes; _i < ghVolumes_1.length; _i++) {
                    vol = ghVolumes_1[_i];
                    if (out_1.startsWith(vol)) {
                        outFound++;
                        break;
                    }
                }
                if (!outFound) {
                    core.warning("you're writing the file to an inaccessible directory...");
                    core.warning("only these directories are mounted by GitHub: [" + ghVolumes.join(', ') + "]");
                }
                // Ensure we create the directory where the file will be saved
                fs_1.mkdirSync(path_1.dirname(out_1), { recursive: true });
                octokit = github.getOctokit(token);
                return [4 /*yield*/, octokit.repos.listReleases()];
            case 1:
                releases = _d.sent();
                // Check if repo has any releases
                if (!releases.data.length) {
                    throw new Error("no releases created in repo '" + repo + "'");
                }
                matchedReleases = releases.data.filter(function (release) {
                    if (version_1 === 'latest' && release.tag_name.startsWith(prefix_1)) {
                        return true;
                    }
                    else if (release.tag_name === prefix_1 + version_1) {
                        return true;
                    }
                    return false;
                });
                // Ensure we found at least one release
                if (!matchedReleases.length) {
                    if (version_1 === 'latest') {
                        throw new Error("could not find a release with the prefix '" + prefix_1 + "' in '" + repo + "'");
                    }
                    else {
                        throw new Error("could not find a release with the prefix/version '" + prefix_1 + version_1 + "' in '" + repo + "'");
                    }
                }
                matchedRelease = void 0;
                matchedAsset = void 0;
                for (_a = 0, matchedReleases_1 = matchedReleases; _a < matchedReleases_1.length; _a++) {
                    release = matchedReleases_1[_a];
                    for (_b = 0, _c = release.assets; _b < _c.length; _b++) {
                        asset = _c[_b];
                        if (asset.name === file) {
                            matchedAsset = asset;
                            matchedRelease = release;
                            break;
                        }
                    }
                }
                matchedVersion = matchedRelease.tag_name.replace(prefix_1, '');
                // Ensure we found an asset
                if (!matchedAsset.id) {
                    throw new Error("could not find an asset with the file name '" + file + "' in '" + repo + "'");
                }
                // Download the release asset and set file mode
                octokit.repos.getReleaseAsset({
                    repo: repo.split('/', 2)[1],
                    owner: repo.split('/', 2)[0],
                    asset_id: matchedAsset.id,
                    headers: {
                        Accept: 'application/octet-stream',
                        Authorization: 'token ' + token
                    }
                }).then(function (res) {
                    res.data.pipe(fs_1.createWriteStream(out_1, { mode: parseInt(mode_1) }));
                });
                // Display confirmation
                core.info("Successfully wrote file to " + out_1 + ".");
                core.info("out=" + out_1);
                core.info("version=" + matchedVersion);
                // Declare Action Outputs
                core.setOutput('out', out_1);
                core.setOutput('version', matchedVersion);
                process.exit(0);
                return [3 /*break*/, 3];
            case 2:
                error_1 = _d.sent();
                if (!token.length) {
                    core.warning('no token was provided, this could be the reason for not finding the repository');
                }
                else {
                    core.warning('by the way, GitHub will return 404 Not Found when the provided token has no access to the repository');
                }
                core.setFailed("" + error_1);
                process.exit(1);
                return [3 /*break*/, 3];
            case 3: return [2 /*return*/];
        }
    });
}); })();
