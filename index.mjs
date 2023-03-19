import core from '@actions/core';
import path from 'path';
import { makeCpanelVersionControlRequest } from './requests.mjs';
import { DeploymentError } from './exceptions.mjs';
import { objToString, sleep } from './utils.mjs';

function setSecrets() {
    core.setSecret('cpanel-url');
    core.setSecret('cpanel-repository-root');
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

    if (core.isDebug) {
        core.debug('Updated cPanel branch informations: ' + objToString(result));
    }
}

async function createDeployment() {
    const { data } = await makeCpanelVersionControlRequest('execute/VersionControlDeployment/create');

    if (!data.deploy_id) {
        throw new DeploymentError('The deployment has not been created in cPanel (empty deploy_id)');
    }

    if (core.isDebug) {
        core.debug('Created deployment with data: ' + objToString(data));
    }
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
            try {
                core.group('Error Log', async () => {
                    const logFileContent = await getLogFileContent(lastDeployment.log_path);
                    core.error(logFileContent);
                });

                throw new DeploymentError('Deployment Error!');
            } catch (e) {
                // If there already has a DeploymentError, re throw it
                if (e instanceof DeploymentError) {
                    throw e;
                }

                throw new DeploymentError(`The deployment has failed! Check the log file at ${lastDeployment.log_path}`);
            }

        }

        if (lastDeployment.timestamps.succeeded) {
            return;
        }

        await sleep(POOLING_RATE_MS);
    };

    throw new DeploymentError(`The cPanel doesn't returned any data after ${timeoutSeconds} seconds`);
}

async function getLogFileContent(logPath) {
    const dirName = path.dirname(logPath);
    const fileName = path.basename(logPath);
    core.info('Retrieving log content from: ' + fileName);

    const result = await makeCpanelVersionControlRequest('execute/Fileman/get_file_content', {
        dir: dirName,
        file: fileName
    });

    return result.data?.content;
}

try {
    setSecrets();

    core.info('Updating cPanel branch information');
    await updateCpanelBranchInfos();

    core.info('Creating cPanel deployment');
    const { deploy_id } = await createDeployment();

    core.info('Waiting cPanel deployment finish...');
    await waitDeploymentCompletion(deploy_id, core.getInput('timeout_ms'));

    core.setOutput('deployment-id', deploy_id);
} catch (error) {
    core.setFailed(error.message);
}
