output "web_url" {
  description = "The website, with HTTPS from App Runner."
  value       = var.web_enabled ? "https://${aws_apprunner_service.web[0].service_url}" : "(web_enabled = false)"
}

output "ecr_repository_urls" {
  description = "Where deploy.sh pushes the images."
  value       = { for k, r in aws_ecr_repository.this : k => r.repository_url }
}

output "image_tag" {
  description = "The image tag currently deployed."
  value       = var.image_tag
}

output "ecs_cluster" {
  value = aws_ecs_cluster.this.name
}

output "ecs_service" {
  value = aws_ecs_service.bot.name
}

output "bot_log_group" {
  description = "Tail with: aws logs tail <group> --follow"
  value       = aws_cloudwatch_log_group.bot.name
}

output "ssm_parameters" {
  description = "Where the secrets live. Set with: aws ssm put-parameter --name <name> --type SecureString --overwrite --value ..."
  value       = { for k, p in aws_ssm_parameter.secret : k => p.name }
}

output "aws_account_id" {
  value = data.aws_caller_identity.current.account_id
}

output "aws_region" {
  value = data.aws_region.current.region
}
