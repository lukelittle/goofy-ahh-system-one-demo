# Deploying to AWS

Everything the demo needs on AWS, as Terraform, for about **$10 a month**
(and $0 while a new account's credits last). Two containers, no servers to
log into, no GPU: the model runs on the author's hosted API and we only pay
for the small things that talk to it.

```text
                     ┌──────────────────────────── AWS account ────────────────────────────┐
                     │                                                                     │
  you ──HTTPS──▶  App Runner ─── web image ─────────┐                                      │
                     │  (website, 0.25 vCPU)        │                                      │
                     │        │ reads                ▼                                      │
                     │        ▼                 ECR (2 repos)          CloudWatch Logs      │
                     │  Parameter Store ◀──────────────────────────── ▲                     │
                     │  (2 SecureStrings)           ▲                  │                     │
                     │        ▲ reads               │ pulls            │ writes             │
                     │        │                     │                  │                     │
                     │   ECS Fargate task ── bot image ────────────────┘                     │
                     │   (Discord bot, 0.25 vCPU, Spot)                                     │
                     │        │  VPC: 2 public subnets, no NAT, SG with no inbound rules    │
                     └────────┼─────────────────────────────────────────────────────────────┘
                              │ outbound HTTPS only
                              ▼
                 Discord gateway  ·  api.decisioncircuits.com (Circuit-VL on the author's GPU)
```

| Piece | AWS service | Why this one |
|---|---|---|
| Website | **App Runner** | It is an HTTP app. App Runner gives an HTTPS URL, certificate, load balancing and scaling from one container image, with no VPC or ALB to pay for. |
| Discord bot | **ECS Fargate** service | It is not an HTTP app: it holds a websocket to Discord open forever. That needs a process that never exits, which Lambda can't do and an ECS service is built for. |
| Images | **ECR** | Private, scanned on push, immutable tags. |
| Secrets | **SSM Parameter Store** (SecureString) | Free, encrypted, and both runtimes can inject parameters as environment variables at start-up. |
| Logs | **CloudWatch Logs** | Both containers, plus VPC flow logs. |

## Cost

Prices in us-east-1, September 2026; rounded. Check the current numbers on
the AWS pricing pages before quoting them.

| Item | Per month |
|---|---|
| Fargate **Spot** task, 0.25 vCPU / 0.5 GB, always on | ~$3 (on-demand: ~$9) |
| Public IPv4 address for the bot task | ~$3.65 |
| App Runner, 0.25 vCPU / 0.5 GB, mostly idle | ~$3–5 (idle memory ~$2.60 + active compute while someone uses it) |
| ECR storage (a few images ≈ 1 GB) | ~$0.10 |
| CloudWatch Logs, Parameter Store, flow logs | cents |
| **Total** | **~$10–12**, or ~$16–18 with on-demand Fargate |

Things deliberately *not* here, and what they would have cost: a NAT gateway
(~$32), an Application Load Balancer (~$16), a KMS key (~$1 each), Container
Insights (a few dollars). `web_enabled = false` drops App Runner and puts
the website on Vercel's free tier instead; then the bill is about $7.

New AWS accounts get $100 in credits (plus up to $100 more for completing
onboarding tasks), which covers this experiment for months.

## Prerequisites

- An AWS account and the [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html), logged in
  (`aws configure` or `aws sso login`) as a user or role that can create the
  resources above. `AdministratorAccess` on a personal sandbox account is the
  simple answer; the roles the *deployed* things run under are minimal.
- [Docker](https://docs.docker.com/get-docker/) with buildx (Docker Desktop has it).
- [Terraform](https://developer.hashicorp.com/terraform/install) 1.9 or newer.
- Node.js 22 and git (you have these if you can run the demo locally).
- The three secrets in `.env.local` at the repo root: `DISCORD_TOKEN`,
  `DISCORD_CLIENT_ID`, `CIRCUIT_API_KEY` (see the main README's Discord bot
  section for where each comes from, and turn on **Server Members Intent**).

## Deploy

```bash
cp deploy/aws/terraform.tfvars.example deploy/aws/terraform.tfvars   # optional: region, name, toggles
deploy/aws/deploy.sh
```

The script does, in order:

1. Checks the tools and that `aws` is logged in.
2. `terraform init`, then creates just the ECR repositories and the two
   Parameter Store entries.
3. Writes your Discord token and Circuit key into Parameter Store with the
   AWS CLI. **Terraform never sees the values**: no secret in state, plan
   files or `tfvars`.
4. Builds both images for `linux/amd64` and pushes them, tagged with the git
   commit.
5. Shows the full plan and applies it (VPC, roles, ECS, App Runner).
6. Registers the `/trueup` and `/howitworks` slash commands with Discord.
7. Prints the website URL and the log group.

Then, in Discord, drag the bot's role above the five archetype roles and run
`/trueup`. First deploy takes about 10 minutes, most of it App Runner
starting.

To ship a change: commit, run `deploy.sh` again. New images get a new tag,
ECS does a rolling replace (with automatic rollback if the new bot never
turns healthy), App Runner does a blue/green deploy.

To remove everything:

```bash
deploy/aws/destroy.sh
```

## Security decisions, and why

This is a toy, but it's built the way a real one should be, so it can be
read as a checklist.

- **No secrets in images, state or the repo.** Secrets are SecureString
  parameters, written by the CLI, read at start-up by each runtime's role
  (`secrets` in the ECS task definition, `runtime_environment_secrets` in
  App Runner). They never appear in a task definition, the console or
  `describe-tasks`. `.dockerignore` and `.gitignore` keep `.env*` out.
- **Least privilege, one role per job.** Four roles; each policy names the
  exact repository, log group and parameters it may touch. No AWS-managed
  policies (`AmazonECSTaskExecutionRolePolicy` would allow pulling any image
  and writing any log group in the account). The bot's *task* role has no
  permissions at all, because the bot calls no AWS APIs. Trust policies are
  pinned to this account with `aws:SourceAccount`.
- **Nothing listens.** The bot's security group has no inbound rules and
  allows outbound only on 443 (plus DNS to the VPC resolver). The bot's
  health endpoint binds to `127.0.0.1`. The VPC's default security group is
  adopted and emptied. Subnets do not auto-assign public IPs.
- **Hardened containers.** Multi-stage builds; the runtime images hold a
  compiled bundle (bot) or Next's standalone server (web), no TypeScript
  toolchain, no dev dependencies. Non-root (`1000:1000`), read-only root
  filesystem for the bot, an init process so signals are delivered, pinned
  base image, health checks. `hadolint` and `checkov` pass with zero
  findings.
- **Immutable, scanned images.** ECR tags can't be overwritten; every push is
  CVE-scanned; each deploy is a git commit you can trace.
- **Safe deploys.** ECS runs exactly one bot (no overlap, so no double
  welcome messages), with a circuit breaker that rolls back a bad image.
  App Runner deploys blue/green.
- **The public route defends itself.** `/api/classify` caps request bodies
  at 13 MB while streaming (a forged `Content-Length` or chunked upload can't
  buffer more), rate-limits to 10 requests a minute per IP and 40 overall
  (the Circuit free tier is 60 a minute, shared with the bot), only accepts
  image data URIs, and never forwards a URL for the server to fetch. The
  site sends `nosniff`, `X-Frame-Options: DENY`, a referrer policy, a
  permissions policy and HSTS, and hides `X-Powered-By`.
- **Observable.** Container logs and VPC flow logs in CloudWatch with a
  retention you choose; every resource tagged for the bill.
- **Reproducible and reviewable.** `terraform validate`, `terraform test`
  (offline, with a mocked provider, in `tests/`) and `checkov` run in CI on
  every push.

Where this stops short of production, on purpose, each with a `checkov:skip`
comment explaining the trade:

| Choice | Why | What production would do |
|---|---|---|
| Bot task has a public IP | No NAT gateway ($32/mo). The IP accepts no connections. | Private subnets + NAT, or VPC endpoints for ECR/SSM/Logs. |
| AWS-owned/managed encryption keys | Customer KMS keys cost $1/month each and change nothing here. | CMKs with rotation for ECR, SSM, logs. |
| 30-day log retention | A year of demo logs is money for nothing. | Longer retention, or export to S3. |
| Fargate Spot | ~70% cheaper; the bot reconnects after an interruption. | On-demand (`bot_use_spot = false`). |
| Local Terraform state | Zero setup for a demo. | S3 backend with locking; see below. |
| No custom domain / WAF | App Runner's URL and TLS are fine for a demo. | A domain on Route 53, WAF in front. |

## Remote state

For anything shared, keep state in S3. Create a bucket (versioned,
encrypted, public access blocked) and add a `backend.tf`:

```hcl
terraform {
  backend "s3" {
    bucket       = "your-tf-state-bucket"
    key          = "goofy-ahh/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
  }
}
```

## Files

| File | What's in it |
|---|---|
| `versions.tf`, `providers.tf` | Terraform and provider pins; default tags. |
| `variables.tf` | Every knob, with validation. `terraform.tfvars.example` shows them. |
| `network.tf` | VPC, subnets, routing, the bot's security group, flow logs. |
| `ecr.tf` | Two repositories, scanning, lifecycle. |
| `secrets.tf` | The two Parameter Store entries (placeholders; `deploy.sh` fills them). |
| `iam.tf` | Four roles and their policies. |
| `bot.tf` | ECS cluster, task definition, service, log group. |
| `web.tf` | App Runner service and autoscaling config. |
| `outputs.tf` | URL, repositories, log group, parameter names. |
| `tests/plan.tftest.hcl` | Offline assertions on the security properties above. |
| `deploy.sh`, `destroy.sh` | The two commands you run. |

## Troubleshooting

- **`deploy.sh` says a tool is missing or `aws` isn't logged in.** See Prerequisites.
- **App Runner stuck in `OPERATION_IN_PROGRESS` for 10+ minutes, then `CREATE_FAILED`.**
  Almost always the health check: open the service's *Logs > Deployment logs*
  in the console. The image must listen on port 3000 and answer
  `/api/classify`.
- **Bot task keeps restarting.** `aws logs tail /ecs/goofy-ahh-bot --follow`.
  A wrong Discord token or missing *Server Members Intent* shows up there
  within seconds.
- **`Not enough capacity`** from Fargate Spot in your AZ: set
  `bot_use_spot = false` and apply.
- **Roles not assigned in Discord.** The bot's role must sit above the five
  archetype roles (Server Settings > Roles); the bot logs a warning naming
  each role it can't manage.
- **Re-running `terraform apply` asks for `image_tag`.** `deploy.sh` writes
  `image_tag.auto.tfvars`; run the script, or pass `-var image_tag=<tag>`.
