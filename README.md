# Deploy to cPanel API action

This action uses the [cPanel API](https://api.docs.cpanel.net/cpanel/introduction) to trigger a git sync process and execute the .cpanel.yml as specified in https://docs.cpanel.net/cpanel/files/git-version-control

## Inputs

| Input                  | Required | Description                    |
|------------------------|:--------:|--------------------------------|
| cpanel-url             |     ✔️    | cPanel access URL              |
| deploy-user            |     ✔️    | cPanel deploy user             |
| deploy-key             |     ✔️    | cPanel deploy key              |
| cpanel-repository-root |     ✔️    | cPanel git repository root     |
| branch                 |     ✔️    | The branch that will be synced |
| timeout_ms             |           | Timeout in ms to wait the deploy status |

## Outputs

### `deployment-id`

cPanel generated deployment ID

## Example usage

```yaml
uses: ivao-brasil/deploy-to-cpanel-api@main
with:
    cpanel-url: "${{ secrets.CPANEL_URL }}"
    deploy-user: "${{ secrets.DEPLOY_USER }}"
    deploy-key: "${{ secrets.DEPLOY_KEY }}"
    cpanel-repository-root: "${{ secrets.REPOSITORY_ROOT }}"
    branch: main
```
