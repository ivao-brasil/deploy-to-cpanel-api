import core from '@actions/core';
import { makeCpanelVersionControlRequest, makeEventSourceRequest } from './requests.mjs';
import { DeploymentError } from './exceptions.mjs';
import { objToString, sleep } from './utils.mjs';

function setSecrets() {
    core.setSecret('deploy-user');
    core.setSecret('deploy-key');
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

async function waitDeploymentCompletion(deploy_id, timeoutSeconds) {
    const POOLING_RATE_MS = 5000; // 5 sec
    let remaningTime = timeoutSeconds;

    while (remaningTime > 0) {
        remaningTime -= POOLING_RATE_MS;

        const { data } = await makeCpanelVersionControlRequest('execute/VersionControlDeployment/retrieve');
        const lastDeployment = data.find((item) => item.deploy_id === deploy_id);
        if (!lastDeployment) {
            return;
        }

        if (lastDeployment.timestamps.failed) {
            throw new DeploymentError(`The deployment has failed! Check the log file at ${lastDeployment.log_path}`);
        }

        if (lastDeployment.timestamps.succeeded) {
            return;
        }

        await sleep(POOLING_RATE_MS);
    };

    throw new DeploymentError(`The cPanel doesn't returned any data after ${timeoutSeconds} seconds`);
}

try {
    setSecrets();

    core.startGroup('Update cPanel branch information');
    await updateCpanelBranchInfos();
    core.endGroup();

    core.startGroup('Creating cPanel deployment');
    const { deploymentId } = await createDeployment();
    core.endGroup();

    core.startGroup('Waiting cPanel deployment finish');
    await waitDeploymentCompletion(deploymentId, core.getInput('timeout'));
    core.endGroup();

    core.setOutput('deployment-id', deploymentId);
} catch (error) {
    core.setFailed(error.message);
}
