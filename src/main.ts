import * as core from '@actions/core';
const Github = require('@actions/github');
const { Octokit } = require("@octokit/rest");
const { retry } = require("@octokit/plugin-retry");
const token = core.getInput('token', { required: true });
const context = Github.context;
const MyOctokit = Octokit.plugin(retry)
const octokit = new MyOctokit({
  auth: token,
  request: {
    retries: 4,
    retryAfter: 60,
  },
});

async function run() {
  const titlePrefix = '[fork-sync]';
  const owner = core.getInput('owner', { required: false }) ||
    context.repo.owner;
  const base = core.getInput('base', { required: false });
  const head = core.getInput('head', { required: false });
  const mergeMethod = core.getInput('merge_method', { required: false });
  const prTitle =
    `${titlePrefix} ${core.getInput('pr_title', { required: false })}`;
  const prMessage = core.getInput('pr_message', { required: false });
  const ignoreFail = core.getInput('ignore_fail', { required: false });
  const autoApprove = core.getInput('auto_approve', { required: false });

  try {
    const ownerHead = `${owner}:${head}`;

    const { data: pullsFromUpstream } = await octokit.pulls.list({
      owner: context.repo.owner,
      repo: context.repo.repo,
      state: 'open',
      head: ownerHead,
      base: base,
      sort: 'created' });

    const thisActionsPRs = pullsFromUpstream.filter(
        pr => pr.title.startsWith(titlePrefix));

    const numOpenSyncPRs = thisActionsPRs.length;

    if (numOpenSyncPRs > 1)
      core.warning('Multiple pulls from this action. This is not ' +
                   'supposed to happen. Using last created PR.');

    if (numOpenSyncPRs > 0) {
      core.info(`Sync PR #${thisActionsPRs[0].number} already open.`);
      return;
    }

    const { data: pr } = await octokit.pulls.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      title: prTitle,
      head: ownerHead,
      base: base,
      body: prMessage,
      merge_method: mergeMethod,
      maintainer_can_modify: false });

    core.info(`Sync PR #${pr.number} created.`)

    if (autoApprove) {
      await octokit.pulls.createReview({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: pr.number,
        event: "COMMENT",
        body: "Auto approved" });
      await octokit.pulls.createReview({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: pr.number,
        event: "APPROVE" });
    }

  } catch (error) {
    if (error?.request?.request?.retryCount) {
      core.error(
        `request failed after ${error.request.request.retryCount} retries ` +
        `with a delay of ${error.request.request.retryAfter}`);
    }
    if (error?.errors?.[0]?.message &&
        error.errors[0].message.startsWith('No commits between')) {
      core.error(
        `No commits between ${context.repo.owner}:${base} and ` +
        `${owner}:${head}`);
    } else {
      if (!ignoreFail) {
        core.setFailed(
          `Failed to create or merge pull request: ${error}`);
      }
    }
  }
}

function delay(s: number) {
  return new Promise( resolve => setTimeout(resolve, s * 1000) );
}

run();
