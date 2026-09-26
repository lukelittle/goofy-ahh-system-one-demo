#!/usr/bin/env bash
# Deploy the Goofy Ahh System One Demo to AWS: website on App Runner, Discord
# bot on ECS Fargate, images in ECR, secrets in Parameter Store.
#
#   deploy/aws/deploy.sh            # interactive: shows the plan, asks before applying
#   deploy/aws/deploy.sh --yes      # no prompts (CI)
#
# Needs: aws (v2, logged in), docker (with buildx), terraform >= 1.9, node >= 22, git.
# Reads DISCORD_TOKEN, DISCORD_CLIENT_ID and CIRCUIT_API_KEY from the
# environment or from .env.local at the repo root. Secrets go straight to
# Parameter Store with the AWS CLI; Terraform never sees their values.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(cd "$here/../.." && pwd)"
auto_approve=()
[[ "${1:-}" == "--yes" || "${1:-}" == "-y" ]] && auto_approve=(-auto-approve)

say()  { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
fail() { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }

# ---- preflight ---------------------------------------------------------------
say "Checking tools"
for tool in aws docker terraform node git; do
  command -v "$tool" >/dev/null || fail "$tool is not installed (see deploy/aws/README.md, Prerequisites)"
done
docker buildx version >/dev/null 2>&1 || fail "docker buildx is not available; install Docker Desktop or the buildx plugin"
docker info >/dev/null 2>&1 || fail "the Docker daemon is not running"
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' || fail "node 22 or newer is required"
account="$(aws sts get-caller-identity --query Account --output text 2>/dev/null)" || fail "aws is not logged in (run: aws configure, or aws sso login)"

# .env.local is the same file the local dev server and the bot use.
if [[ -f "$root/.env.local" ]]; then
  set -a; # shellcheck disable=SC1091
  source "$root/.env.local"; set +a
fi
: "${DISCORD_TOKEN:?set DISCORD_TOKEN (Developer Portal > Bot > Reset Token), in the environment or .env.local}"
: "${DISCORD_CLIENT_ID:?set DISCORD_CLIENT_ID (Developer Portal > General Information > Application ID)}"
: "${CIRCUIT_API_KEY:?set CIRCUIT_API_KEY (free key at https://decisioncircuits.com/#api)}"

cd "$here"

# The image tag is the commit being deployed (plus a timestamp if the tree is dirty).
tag="$(git -C "$root" rev-parse --short=12 HEAD)"
[[ -n "$(git -C "$root" status --porcelain)" ]] && tag="$tag-$(date -u +%Y%m%d%H%M%S)"

say "Terraform init"
terraform init -input=false

# Read the effective variable values (terraform.tfvars, defaults) so the script and Terraform agree.
tfvar() { terraform console -var "image_tag=$tag" <<<"var.$1" | tr -d '"'; }
region="$(tfvar aws_region)"
name="$(tfvar name)"
web_enabled="$(tfvar web_enabled)"
echo "account $account, region $region, name $name, image tag $tag"

# ---- phase 1: registry and secret containers ----------------------------------
say "Creating ECR repositories and Parameter Store entries"
terraform apply -input=false -auto-approve -var "image_tag=$tag" \
  -target='aws_ecr_repository.this' -target='aws_ecr_lifecycle_policy.this' -target='aws_ssm_parameter.secret' >/dev/null

say "Writing secrets to Parameter Store (values never touch Terraform state)"
aws ssm put-parameter --region "$region" --name "/$name/discord-token"   --type SecureString --overwrite --value "$DISCORD_TOKEN"   >/dev/null
aws ssm put-parameter --region "$region" --name "/$name/circuit-api-key" --type SecureString --overwrite --value "$CIRCUIT_API_KEY" >/dev/null
echo "/$name/discord-token, /$name/circuit-api-key"

# ---- phase 2: build and push images -------------------------------------------
say "Logging in to ECR"
registry="$account.dkr.ecr.$region.amazonaws.com"
aws ecr get-login-password --region "$region" | docker login --username AWS --password-stdin "$registry" >/dev/null

say "Building and pushing images (linux/amd64: Fargate Spot and App Runner are x86)"
docker buildx build --platform linux/amd64 --provenance=false -f "$root/Dockerfile.bot" -t "$registry/$name/bot:$tag" --push "$root"
if [[ "$web_enabled" == "true" ]]; then
  docker buildx build --platform linux/amd64 --provenance=false -f "$root/Dockerfile" -t "$registry/$name/web:$tag" --push "$root"
fi

# ---- phase 3: everything else -------------------------------------------------
say "Deploying"
printf 'image_tag = "%s"\n' "$tag" > image_tag.auto.tfvars   # so a plain `terraform apply` later reuses this tag
terraform apply -input=false "${auto_approve[@]}"

# ---- slash commands -----------------------------------------------------------
say "Registering /trueup and /howitworks with Discord"
if [[ ! -d "$root/node_modules" ]]; then (cd "$root" && npm ci --silent); fi
(cd "$root" && DISCORD_TOKEN="$DISCORD_TOKEN" DISCORD_CLIENT_ID="$DISCORD_CLIENT_ID" node --import tsx bot/register.ts)

# ---- done ---------------------------------------------------------------------
say "Done"
terraform output
cat <<EOF

Next:
  1. In Discord: Server Settings > Roles, drag the bot's role ABOVE the five archetype roles.
  2. Run /trueup once to classify everyone already in the server.
  3. Watch the bot:  aws logs tail $(terraform output -raw bot_log_group) --region $region --follow
  4. Tear it all down when the experiment is over:  deploy/aws/destroy.sh
EOF
