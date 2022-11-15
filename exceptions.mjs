export class HTTPResponseError extends Error {
	constructor(response) {
		super(`HTTP Error Response: ${response.status} ${response.statusText}`);
		this.response = response;
	}
}

export class CPanelError extends Error {
	constructor(errorList) {
		super(`Error while triggering the deploy in cPanel: ${errorList.toString()}`);
	}
}

export class DeploymentSetupError extends Error {
	constructor(error) {
		super(error);
	}
}

export class DeploymentCreateError extends Error {
	constructor(error) {
		super(error);
	}
}

