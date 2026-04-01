# Weekly pilot snapshot in CI / cron

The script [`deploy/scripts/pilot-weekly-snapshot.mjs`](../../deploy/scripts/pilot-weekly-snapshot.mjs) calls **`GET /api/v1/support/pilots/weekly-report`** and prints JSON or Markdown.

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `API_BASE_URL` | Yes | API origin (no trailing slash) |
| `SUPPORT_API_KEY` | Yes | Read key |
| `SLACK_WEBHOOK_URL` | No | With `--format md`, posts a short summary to Slack |

## Schedule

- **GitHub Actions:** add a `workflow_dispatch` or `schedule` job that sets secrets `API_BASE_URL`, `SUPPORT_API_KEY`, optional `SLACK_WEBHOOK_URL`, and runs:  
  `node deploy/scripts/pilot-weekly-snapshot.mjs --format md`
- **External:** n8n, cron on a bastion, or k8s CronJob with the same command.

Do not commit support keys; use the platform secret store.
