# Offline checks of the configuration with a mocked AWS provider: no
# credentials, no account, nothing created. Run with `terraform test`.
# These pin the security decisions so a later edit can't quietly undo them.

mock_provider "aws" {
  # The mock would fill computed attributes with random strings; IAM roles
  # validate their policy at plan time, so give policy documents real JSON.
  mock_data "aws_iam_policy_document" {
    defaults = {
      json = "{\"Version\":\"2012-10-17\",\"Statement\":[]}"
    }
  }
  # Attributes the provider validates at plan time (ARNs, URLs) need
  # realistic shapes rather than the mock's random strings.
  mock_resource "aws_iam_role" {
    defaults = { arn = "arn:aws:iam::123456789012:role/mock-role" }
  }
  mock_resource "aws_ecr_repository" {
    defaults = {
      arn            = "arn:aws:ecr:us-east-1:123456789012:repository/mock"
      repository_url = "123456789012.dkr.ecr.us-east-1.amazonaws.com/mock"
    }
  }
  mock_resource "aws_cloudwatch_log_group" {
    defaults = { arn = "arn:aws:logs:us-east-1:123456789012:log-group:mock" }
  }
  mock_resource "aws_ssm_parameter" {
    defaults = { arn = "arn:aws:ssm:us-east-1:123456789012:parameter/mock" }
  }
  mock_resource "aws_ecs_cluster" {
    defaults = {
      id  = "arn:aws:ecs:us-east-1:123456789012:cluster/mock"
      arn = "arn:aws:ecs:us-east-1:123456789012:cluster/mock"
    }
  }
  mock_resource "aws_ecs_task_definition" {
    defaults = { arn = "arn:aws:ecs:us-east-1:123456789012:task-definition/mock:1" }
  }
  mock_resource "aws_apprunner_auto_scaling_configuration_version" {
    defaults = { arn = "arn:aws:apprunner:us-east-1:123456789012:autoscalingconfiguration/mock/1/abc" }
  }
  mock_resource "aws_apprunner_service" {
    defaults = { service_url = "mock.us-east-1.awsapprunner.com" }
  }
  override_data {
    target = data.aws_availability_zones.available
    values = {
      names = ["us-east-1a", "us-east-1b", "us-east-1c"]
    }
  }
  override_data {
    target = data.aws_caller_identity.current
    values = {
      account_id = "123456789012"
    }
  }
  override_data {
    target = data.aws_region.current
    values = {
      region = "us-east-1"
    }
  }
}

variables {
  image_tag = "abc1234def56"
}

run "defaults" {
  assert {
    condition     = length(aws_subnet.public) == 2 && aws_subnet.public[0].availability_zone != aws_subnet.public[1].availability_zone
    error_message = "two public subnets in two different AZs"
  }

  assert {
    condition     = length(aws_subnet.public) == 2 && alltrue([for s in aws_subnet.public : !s.map_public_ip_on_launch])
    error_message = "subnets must not hand out public IPs on their own"
  }

  assert {
    condition     = aws_vpc_security_group_egress_rule.bot_https.from_port == 443 && aws_vpc_security_group_egress_rule.bot_https.to_port == 443
    error_message = "internet egress is HTTPS only"
  }

  assert {
    condition     = alltrue([for r in aws_ecr_repository.this : r.image_tag_mutability == "IMMUTABLE" && r.image_scanning_configuration[0].scan_on_push])
    error_message = "ECR repositories must be immutable and scanned on push"
  }

  assert {
    condition     = alltrue([for p in aws_ssm_parameter.secret : p.type == "SecureString"])
    error_message = "secrets must be SecureString parameters"
  }

  assert {
    condition     = jsondecode(aws_ecs_task_definition.bot.container_definitions)[0].readonlyRootFilesystem == true
    error_message = "the bot container must have a read-only root filesystem"
  }

  assert {
    condition     = jsondecode(aws_ecs_task_definition.bot.container_definitions)[0].user == "1000:1000"
    error_message = "the bot container must not run as root"
  }

  assert {
    condition     = !contains([for e in jsondecode(aws_ecs_task_definition.bot.container_definitions)[0].environment : e.name], "DISCORD_TOKEN") && !contains([for e in jsondecode(aws_ecs_task_definition.bot.container_definitions)[0].environment : e.name], "CIRCUIT_API_KEY")
    error_message = "secrets must be injected through `secrets` (Parameter Store), never as plain environment variables"
  }

  assert {
    condition     = toset([for s in jsondecode(aws_ecs_task_definition.bot.container_definitions)[0].secrets : s.name]) == toset(["DISCORD_TOKEN", "CIRCUIT_API_KEY"])
    error_message = "the bot needs exactly its two secrets"
  }

  assert {
    condition     = aws_iam_role.bot_execution.name_prefix != aws_iam_role.bot_task.name_prefix
    error_message = "execution role and task role must be separate roles"
  }

  assert {
    condition     = aws_ecs_service.bot.desired_count == 1 && aws_ecs_service.bot.deployment_maximum_percent == 100 && aws_ecs_service.bot.deployment_minimum_healthy_percent == 0
    error_message = "exactly one bot task, never two at once"
  }

  assert {
    condition     = one(aws_ecs_service.bot.capacity_provider_strategy).capacity_provider == "FARGATE_SPOT"
    error_message = "the default is Fargate Spot"
  }

  assert {
    condition     = !aws_ecs_service.bot.enable_execute_command
    error_message = "no ECS Exec into the task"
  }

  assert {
    condition     = one(aws_ecs_service.bot.deployment_circuit_breaker).rollback
    error_message = "failed deployments must roll back"
  }

  assert {
    condition     = length(aws_apprunner_service.web) == 1 && aws_apprunner_service.web[0].instance_configuration[0].cpu == "256" && aws_apprunner_service.web[0].instance_configuration[0].memory == "512"
    error_message = "the website runs on the smallest App Runner size"
  }

  assert {
    condition     = aws_apprunner_service.web[0].source_configuration[0].image_repository[0].image_configuration[0].port == "3000"
    error_message = "App Runner must route to the Next.js port"
  }

  assert {
    condition     = !contains(keys(aws_apprunner_service.web[0].source_configuration[0].image_repository[0].image_configuration[0].runtime_environment_variables), "CIRCUIT_API_KEY")
    error_message = "the website's API key must come from runtime_environment_secrets, not a plain variable"
  }

  assert {
    condition     = length(aws_flow_log.this) == 1
    error_message = "flow logs on by default"
  }
}

run "bot_only" {
  variables {
    image_tag    = "abc1234def56"
    web_enabled  = false
    bot_use_spot = false
  }

  assert {
    condition     = length(aws_apprunner_service.web) == 0 && length(aws_iam_role.apprunner_instance) == 0 && length(aws_iam_role.apprunner_ecr_access) == 0
    error_message = "web_enabled = false must create no App Runner resources or roles"
  }

  assert {
    condition     = one(aws_ecs_service.bot.capacity_provider_strategy).capacity_provider == "FARGATE"
    error_message = "bot_use_spot = false must use on-demand Fargate"
  }

  assert {
    condition     = !contains([for e in jsondecode(aws_ecs_task_definition.bot.container_definitions)[0].environment : e.name], "DEMO_URL")
    error_message = "without the website there is no DEMO_URL (empty values are dropped)"
  }
}

run "rejects_bad_inputs" {
  command = plan

  variables {
    image_tag = "abc1234def56"
    name      = "Not Valid!"
  }

  expect_failures = [var.name]
}
