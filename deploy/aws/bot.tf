# The Discord bot: one Fargate task in an ECS service. A Discord bot holds a
# websocket to Discord's gateway open all the time, so it needs a process
# that never stops, which is what an ECS service provides (and Lambda does
# not). 0.25 vCPU and 512 MB is plenty; Fargate Spot makes it about $3/month.

resource "aws_cloudwatch_log_group" "bot" {
  #checkov:skip=CKV_AWS_338: retention is var.log_retention_days (30 by default); a year of demo logs is cost without purpose. Raise it for anything real.
  #checkov:skip=CKV_AWS_158: CloudWatch encrypts log data at rest by default; a customer KMS key adds $1/month for no change in this threat model.
  name              = "/ecs/${var.name}-bot"
  retention_in_days = var.log_retention_days
}

resource "aws_ecs_cluster" "this" {
  #checkov:skip=CKV_AWS_65: Container Insights is optional here (var.container_insights) because it costs a few dollars a month for a single task.
  name = var.name

  setting {
    name  = "containerInsights"
    value = var.container_insights ? "enabled" : "disabled"
  }
}

resource "aws_ecs_cluster_capacity_providers" "this" {
  cluster_name       = aws_ecs_cluster.this.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]
}

locals {
  bot_image = "${aws_ecr_repository.this["bot"].repository_url}:${var.image_tag}"

  bot_environment = {
    NODE_ENV                   = "production"
    CIRCUIT_URL                = var.circuit_url
    CIRCUIT_MODEL              = var.circuit_model
    CIRCUIT_MIN_INTERVAL_MS    = tostring(var.circuit_min_interval_ms)
    DISCORD_WELCOME_CHANNEL_ID = var.discord_welcome_channel_id
    DEMO_URL                   = var.web_enabled ? "https://${aws_apprunner_service.web[0].service_url}" : ""
    HEALTH_PORT                = "8080"
  }

  # Secrets are fetched by the ECS agent from Parameter Store at task start
  # and injected as environment variables. They never appear in the task
  # definition, the console, or `describe-tasks`.
  bot_secrets = {
    DISCORD_TOKEN   = aws_ssm_parameter.secret["discord_token"].arn
    CIRCUIT_API_KEY = aws_ssm_parameter.secret["circuit_api_key"].arn
  }
}

resource "aws_ecs_task_definition" "bot" {
  family                   = "${var.name}-bot"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.bot_execution.arn
  task_role_arn            = aws_iam_role.bot_task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "X86_64" # Fargate Spot is x86 only
  }

  container_definitions = jsonencode([{
    name      = "bot"
    image     = local.bot_image
    essential = true

    # Hardening: an unprivileged user, a read-only filesystem (the bot writes
    # nothing), and a real init process so signals reach Node.
    user                   = "1000:1000"
    readonlyRootFilesystem = true
    linuxParameters        = { initProcessEnabled = true }

    environment = [for k, v in local.bot_environment : { name = k, value = v } if v != ""] # ECS rejects empty values
    secrets     = [for k, v in local.bot_secrets : { name = k, valueFrom = v }]

    # The bot serves /health on localhost only (bot/health.ts): 200 while the
    # gateway connection is up. ECS replaces the task if this keeps failing.
    healthCheck = {
      command     = ["CMD", "node", "-e", "fetch('http://127.0.0.1:8080/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 60
    }

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.bot.name
        awslogs-region        = data.aws_region.current.region
        awslogs-stream-prefix = "bot"
      }
    }
  }])
}

resource "aws_ecs_service" "bot" {
  #checkov:skip=CKV_AWS_333: the task needs a route to the internet and this VPC has no NAT gateway ($32/month). The public IP accepts no inbound traffic: the security group has no ingress rules and the bot listens on localhost only.
  name            = "${var.name}-bot"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.bot.arn
  desired_count   = 1
  propagate_tags  = "SERVICE"

  capacity_provider_strategy {
    capacity_provider = var.bot_use_spot ? "FARGATE_SPOT" : "FARGATE"
    weight            = 1
  }

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.bot.id]
    assign_public_ip = true
  }

  # One bot at a time: stop the old task before starting the new one, so two
  # copies never answer the same Discord event. Deploys cost a few seconds of
  # downtime, which a Discord bot does not notice.
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100

  # If a new image never becomes healthy, roll back to the last one that did.
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  enable_execute_command = false

  depends_on = [aws_ecs_cluster_capacity_providers.this, aws_iam_role_policy.bot_execution]
}
