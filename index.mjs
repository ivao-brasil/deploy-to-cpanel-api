import { inspect } from 'util';
import core from '@actions/core';
import fetch from 'node-fetch';
import { CPanelError, DeploymentError, HTTPResponseError } from './exceptions.mjs';
import EventSource from 'eventsource';

function throwIfHasResponseError(response) {
    if (!response.ok) {
        throw new HTTPResponseError(response);
    }
}

function throwIfHasCpanelErrors(resultJson) {
    if (!resultJson.status) {
        throw new CPanelError(resultJson.errors);
    }
}

function setSecrets() {
    core.setSecret('deploy-user');
    core.setSecret('deploy-key');
}

function objToString(obj) {
    return inspect(obj, { showHidden: false, depth: null, colors: true });
}

async function makeCpanelVersionControlRequest(endpointUrl, params) {
    const cpanelUrl = core.getInput('cpanel-url');
    const deployUser = core.getInput('deploy-user');
    const deployKey = core.getInput('deploy-key');
    const repoRoot = core.getInput('cpanel-repository-root');

    const authHeader = `cpanel ${deployUser}:${deployKey}`;
    const requestQuery = new URLSearchParams({
        'repository_root': repoRoot,
        ...params
    });

    const fetchUrl = `${cpanelUrl}/${endpointUrl}?${requestQuery.toString()}`;
    core.info(`Sending request to: '${cpanelUrl}/${endpointUrl}'`);

    if (core.isDebug()) {
        core.info('Repository root: ' + repoRoot);
        core.info('Additional params: ' + objToString(params));
        core.info('Auth string: ' + authHeader);
    }

    const headers = {
        'Authorization': authHeader,
        accept: 'application/json'
    };

    if (core.isDebug()) {
        core.info(`With headers: '${objToString(headers)}'`);
    }

    const response = await fetch(fetchUrl, {
        headers,
    });

    throwIfHasResponseError(response);

    const result = await response.json();
    if (core.isDebug()) {
        core.info(`Result: '${objToString(result)}'`);
    }

    throwIfHasCpanelErrors(result);

    return result;
}

async function updateCpanelBranchInfos() {
    const branch = core.getInput('branch');

    const result = await makeCpanelVersionControlRequest('execute/VersionControl/update', {
        'branch': branch
    });

    if (!result.data.deployable) {
        throw new DeploymentError('The input branch is not deployable. It\'s source tree is clean?');
    }

    core.info('Updated cPanel branch informations: ' + objToString(result));
}

async function createDeployment() {
    const { data } = await makeCpanelVersionControlRequest('execute/VersionControlDeployment/create');

    if (!data.deploy_id) {
        throw new DeploymentError('The deployment has not been created in cPanel (empty deploy_id)');
    }

    core.info('Created deployment with data: ' + objToString(data));
    return data;
}

async function watchDeploymentLog({ sse_url }) {
    const event = new EventSource(sse_url);
    event.addEventListener('task_processing', ({ data }) => {
        core.info('The deployment task is processing in cPanel...');
        if (core.isDebug()) {
            core.info(`Event data: ${objToString(data)}`);
        }
    });

    event.addEventListener('task_complete', ({ data }) => {
        core.info('cPanel deploy is complete...');
        if (core.isDebug()) {
            core.info(`Event data: ${objToString(data)}`);
        }
    });

    event.addEventListener('task_failed', ({ data }) => {
        if (core.isDebug()) {
            core.info(`Event data: ${objToString(data)}`);
        }

        throw new DeploymentError('cPanel deploy has failed! Check its logs to see what happened.');
    });
}

try {
    setSecrets();

    core.startGroup('Update cPanel branch information');
    await updateCpanelBranchInfos();
    core.endGroup();

    core.startGroup('Creating cPanel deployment');
    const { deploymentId, ...deployData } = await createDeployment();
    core.endGroup();

    core.startGroup('Waiting cPanel deployment finish');
    await watchDeploymentLog(deployData);
    core.endGroup();

    core.setOutput('deployment-id', deploymentId);
} catch (error) {
    core.setFailed(error.message);
}
