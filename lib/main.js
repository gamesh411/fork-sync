"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const Github = require('@actions/github');
const { Octokit } = require("@octokit/rest");
const { retry } = require("@octokit/plugin-retry");
const token = core.getInput('token', { required: true });
const context = Github.context;
const MyOctokit = Octokit.plugin(retry);
const octokit = new MyOctokit({
    auth: token,
    request: {
        retries: 4,
        retryAfter: 60,
    },
});
function run() {
    var _a, _b, _c, _d;
    return __awaiter(this, void 0, void 0, function* () {
        const titlePrefix = '[fork-sync]';
        const owner = core.getInput('owner', { required: false }) ||
            context.repo.owner;
        const base = core.getInput('base', { required: false });
        const head = core.getInput('head', { required: false });
        const mergeMethod = core.getInput('merge_method', { required: false });
        const prTitle = `${titlePrefix} ${core.getInput('pr_title', { required: false })}`;
        const prMessage = core.getInput('pr_message', { required: false });
        const ignoreFail = core.getInput('ignore_fail', { required: false });
        const autoApprove = core.getInput('auto_approve', { required: false });
        try {
            const ownerHead = `${owner}:${head}`;
            const { data: pullsFromUpstream } = yield octokit.pulls.list({
                owner: context.repo.owner,
                repo: context.repo.repo,
                state: 'open',
                head: ownerHead,
                base: base,
                sort: 'created'
            });
            const thisActionsPRs = pullsFromUpstream.filter(pr => pr.title.startsWith(titlePrefix));
            const numOpenSyncPRs = thisActionsPRs.length;
            if (numOpenSyncPRs > 1)
                core.warning('Multiple pulls from this action. This is not ' +
                    'supposed to happen. Using last created PR.');
            if (numOpenSyncPRs > 0) {
                core.info(`Sync PR #${thisActionsPRs[0].number} already open.`);
                return;
            }
            const { data: pr } = yield octokit.pulls.create({
                owner: context.repo.owner,
                repo: context.repo.repo,
                title: prTitle,
                head: ownerHead,
                base: base,
                body: prMessage,
                merge_method: mergeMethod,
                maintainer_can_modify: false
            });
            core.info(`Sync PR #${pr.number} created.`);
            if (autoApprove) {
                yield octokit.pulls.createReview({
                    owner: context.repo.owner,
                    repo: context.repo.repo,
                    pull_number: pr.number,
                    event: "COMMENT",
                    body: "Auto approved"
                });
                yield octokit.pulls.createReview({
                    owner: context.repo.owner,
                    repo: context.repo.repo,
                    pull_number: pr.number,
                    event: "APPROVE"
                });
            }
        }
        catch (error) {
            if ((_b = (_a = error === null || error === void 0 ? void 0 : error.request) === null || _a === void 0 ? void 0 : _a.request) === null || _b === void 0 ? void 0 : _b.retryCount) {
                core.error(`request failed after ${error.request.request.retryCount} retries ` +
                    `with a delay of ${error.request.request.retryAfter}`);
            }
            if (((_d = (_c = error === null || error === void 0 ? void 0 : error.errors) === null || _c === void 0 ? void 0 : _c[0]) === null || _d === void 0 ? void 0 : _d.message) &&
                error.errors[0].message.startsWith('No commits between')) {
                core.error(`No commits between ${context.repo.owner}:${base} and ` +
                    `${owner}:${head}`);
            }
            else {
                if (!ignoreFail) {
                    core.setFailed(`Failed to create or merge pull request: ${error}`);
                }
            }
        }
    });
}
function delay(s) {
    return new Promise(resolve => setTimeout(resolve, s * 1000));
}
run();
