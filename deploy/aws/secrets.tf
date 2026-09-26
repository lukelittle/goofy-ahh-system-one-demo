# Secrets live in SSM Parameter Store as SecureStrings (free at the standard
# tier). Terraform creates each parameter with a placeholder and then ignores
# its value, so the real Discord token and API key are written by deploy.sh
# with `aws ssm put-parameter` and never pass through Terraform state, a
# plan file, or a variables file. The containers read them at start-up
# through their execution/instance roles; they are never baked into images.

locals {
  secret_placeholder = "SET-ME-WITH-deploy.sh"
  secrets = {
    discord_token   = "Discord bot token (Developer Portal > Bot > Reset Token)"
    circuit_api_key = "Circuit API key (https://decisioncircuits.com/#api)"
  }
}

resource "aws_ssm_parameter" "secret" {
  for_each = local.secrets

  #checkov:skip=CKV_AWS_337: encrypted with the AWS-managed aws/ssm key; a customer KMS key adds $1/month and an extra policy for no gain at this scale.
  name        = "/${var.name}/${replace(each.key, "_", "-")}"
  description = each.value
  type        = "SecureString"
  value       = local.secret_placeholder

  lifecycle {
    ignore_changes = [value]
  }
}
