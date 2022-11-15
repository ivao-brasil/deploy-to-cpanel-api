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

async function makeCpanelVersionControlRequest(endpointUrl, body) {
    const cpanelUrl = core.getInput('cpanel-url');
    const deployUser = core.getInput('deploy-user');
    const deployKey = core.getInput('deploy-key');
    const repoRoot = core.getInput('cpanel-repository-root');

    const fetchUrl = `${cpanelUrl}/${endpointUrl}`;
    const authHeader = `cpanel ${{ deployUser }}:${{ deployKey }}"`;
    const response = await fetch(fetchUrl, {
        headers: {
            'Authorization': authHeader,
            accept: 'application/json'
        },
        body: {
            'repository_root': repoRoot,
            ...body
        }
    });

    throwIfHasResponseError(response);

    const { result } = await response.json();
    throwIfHasCpanelErrors(result);

    return result;
}

async function updateCpanelBranchInfos() {
    const branch = core.getInput('branch');

    const result = await makeCpanelVersionControlRequest('/execute/VersionControl/update', {
        'branch': branch
    });

    if (!result.deployable) {
        throw new DeploymentSetupError('The input branch is not deployable. It\'s source tree is clean?');
    }

    core.info('Updated cPanel branch informations: ' + JSON.stringify(result, null, 2));
}

async function createDeployment() {
    const { deploy_id } = await makeCpanelVersionControlRequest('/execute/VersionControlDeployment/create');

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
