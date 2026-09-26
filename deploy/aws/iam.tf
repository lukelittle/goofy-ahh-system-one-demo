# Four roles, each with only what its job needs. No AWS-managed policies:
# AmazonECSTaskExecutionRolePolicy, for example, allows pulling any image and
# writing any log group in the account, which this demo does not need.

locals {
  ecr_pull_actions = ["ecr:BatchCheckLayerAvailability", "ecr:GetDownloadUrlForLayer", "ecr:BatchGetImage"]
}

# ---- ECS: the role the ECS agent uses to start the bot task -----------------

data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
    # Only tasks in this account and this cluster may assume the role.
    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values   = ["arn:aws:ecs:${data.aws_region.current.region}:${data.aws_caller_identity.current.account_id}:*"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

data "aws_iam_policy_document" "bot_execution" {
  statement {
    sid       = "EcrLogin"
    actions   = ["ecr:GetAuthorizationToken"] # this action only supports "*"
    resources = ["*"]
  }
  statement {
    sid       = "PullBotImage"
    actions   = local.ecr_pull_actions
    resources = [aws_ecr_repository.this["bot"].arn]
  }
  statement {
    sid       = "WriteBotLogs"
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents"]
    resources = ["${aws_cloudwatch_log_group.bot.arn}:*"]
  }
  statement {
    sid       = "ReadBotSecrets"
    actions   = ["ssm:GetParameters"]
    resources = [aws_ssm_parameter.secret["discord_token"].arn, aws_ssm_parameter.secret["circuit_api_key"].arn]
  }
}

resource "aws_iam_role" "bot_execution" {
  name_prefix        = "${var.name}-bot-exec-"
  description        = "ECS task execution role for the bot: pull its image, write its logs, read its two secrets"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy" "bot_execution" {
  name   = "bot-execution"
  role   = aws_iam_role.bot_execution.id
  policy = data.aws_iam_policy_document.bot_execution.json
}

# The task role is what the bot's own code would use to call AWS. It calls
# nothing, so the role has no permissions; it exists so the task never falls
# back to anything broader.
resource "aws_iam_role" "bot_task" {
  name_prefix        = "${var.name}-bot-task-"
  description        = "ECS task role for the bot: intentionally empty, the bot calls no AWS APIs"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

# ---- App Runner: pull the website image, and read its API key ---------------

data "aws_iam_policy_document" "apprunner_build_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["build.apprunner.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

data "aws_iam_policy_document" "apprunner_ecr_access" {
  statement {
    sid       = "EcrLogin"
    actions   = ["ecr:GetAuthorizationToken"] # this action only supports "*"
    resources = ["*"]
  }
  statement {
    sid       = "PullWebImage"
    actions   = concat(local.ecr_pull_actions, ["ecr:DescribeImages"])
    resources = [aws_ecr_repository.this["web"].arn]
  }
}

resource "aws_iam_role" "apprunner_ecr_access" {
  count = var.web_enabled ? 1 : 0

  name_prefix        = "${var.name}-web-ecr-"
  description        = "App Runner access role: pull the website image from ECR"
  assume_role_policy = data.aws_iam_policy_document.apprunner_build_assume.json
}

resource "aws_iam_role_policy" "apprunner_ecr_access" {
  count = var.web_enabled ? 1 : 0

  name   = "pull-web-image"
  role   = aws_iam_role.apprunner_ecr_access[0].id
  policy = data.aws_iam_policy_document.apprunner_ecr_access.json
}

data "aws_iam_policy_document" "apprunner_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["tasks.apprunner.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

data "aws_iam_policy_document" "apprunner_instance" {
  statement {
    sid       = "ReadCircuitKey"
    actions   = ["ssm:GetParameters"]
    resources = [aws_ssm_parameter.secret["circuit_api_key"].arn]
  }
}

resource "aws_iam_role" "apprunner_instance" {
  count = var.web_enabled ? 1 : 0

  name_prefix        = "${var.name}-web-instance-"
  description        = "App Runner instance role for the website: read the Circuit API key"
  assume_role_policy = data.aws_iam_policy_document.apprunner_tasks_assume.json
}

resource "aws_iam_role_policy" "apprunner_instance" {
  count = var.web_enabled ? 1 : 0

  name   = "read-circuit-key"
  role   = aws_iam_role.apprunner_instance[0].id
  policy = data.aws_iam_policy_document.apprunner_instance.json
}
