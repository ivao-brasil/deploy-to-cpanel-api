import core from '@actions/core';
import fetch from 'node-fetch';
import { CPanelError, HTTPResponseError } from './exceptions.mjs';
import { objToString } from './utils.mjs';

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

function getAuthenticationHeader() {
    const deployUser = core.getInput('deploy-user');
    const deployKey = core.getInput('deploy-key');
    const authHeader = `cpanel ${deployUser}:${deployKey}`;
    if (core.isDebug()) {
        core.debug('Generated auth header: ' + authHeader);
    }

    return authHeader;
}

export async function makeCpanelVersionControlRequest(endpointUrl, params) {
    const cpanelUrl = core.getInput('cpanel-url');
    const repoRoot = core.getInput('cpanel-repository-root');

    const requestQuery = new URLSearchParams({
        'repository_root': repoRoot,
        ...params
    });

    const fetchUrl = `${cpanelUrl}/${endpointUrl}?${requestQuery.toString()}`;

    if (core.isDebug()) {
        core.debug(`Sending request to: '${cpanelUrl}/${endpointUrl}'`);
        core.debug('Repository root: ' + repoRoot);
        core.debug('Additional params: ' + objToString(params));
    }

    const headers = {
        'Authorization': getAuthenticationHeader(),
        accept: 'application/json'
    };

    if (core.isDebug()) {
        core.debug(`With headers: '${objToString(headers)}'`);
    }

    const response = await fetch(fetchUrl, {
        headers,
    });

    throwIfHasResponseError(response);

    const result = await response.json();
    if (core.isDebug()) {
        core.debug(`Result: '${objToString(result)}'`);
    }

    throwIfHasCpanelErrors(result);

    return result;
}
