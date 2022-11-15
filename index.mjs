import { inspect } from 'util';
import core from '@actions/core';
import fetch from 'node-fetch';
import { CPanelError, DeploymentSetupError, HTTPResponseError, DeploymentCreateError } from './exceptions.mjs';

function throwIfHasResponseError(response) {
    if (!response.ok) {
        throw new HTTPResponseError(response);
    }
}

function throwIfHasCpanelErrors(resultJson) {
    if (!resultJson.status) {
        throw CPanelError(resultJson.errors);
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

    const authHeader = `cpanel ${{ deployUser }}:${{ deployKey }}"`;
    const requestParams = {
        'repository_root': repoRoot,
        ...params
    };
    const requestQuery = new URLSearchParams(requestParams);
    const fetchUrl = `${cpanelUrl}/${endpointUrl}?${requestQuery.toString()}`;
    core.info(`Sending request to: '${cpanelUrl}/${endpointUrl}'`);
    if (core.isDebug()) {
        core.info(`With params: '${objToString(requestParams)}'`);
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

    if (core.isDebug()) {
        core.info(`Response: '${objToString(response)}'`);
    }

    throwIfHasResponseError(response);

    const { result } = await response.json();
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

    if (!result.deployable) {
        throw new DeploymentSetupError('The input branch is not deployable. It\'s source tree is clean?');
    }

    core.info('Updated cPanel branch informations: ' + JSON.stringify(result, null, 2));
}

async function createDeployment() {
    const { deploy_id } = await makeCpanelVersionControlRequest('execute/VersionControlDeployment/create');

    if (!deploy_id) {
        throw new DeploymentCreateError('The deployment has not been created in cPanel (empty deploy_id)');
    }


    core.info('Created deployment with ID: ' + deploy_id);
    return deploy_id;
}

try {
    setSecrets();

    core.startGroup('Update cPanel branch information');
    await updateCpanelBranchInfos();
    core.endGroup();

    core.startGroup('Creating cPanel deployment');
    const deploymentId = await createDeployment();
    core.endGroup();

    core.setOutput('deployment-id', deploymentId);
} catch (error) {
    core.setFailed(error.message);
}
