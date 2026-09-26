#!/usr/bin/env bash
# Remove everything deploy.sh created: the App Runner service, the ECS
# service and cluster, the VPC, the ECR repositories (images included), the
# Parameter Store secrets, the roles and the log groups. Nothing is left to
# bill you afterwards.
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$here"
[[ -f image_tag.auto.tfvars ]] || printf 'image_tag = "none"\n' > image_tag.auto.tfvars
terraform init -input=false >/dev/null
terraform destroy -input=false "$@"
rm -f image_tag.auto.tfvars
echo "Gone. Discord still has the five roles and the bot's membership; remove those by hand if you want."
