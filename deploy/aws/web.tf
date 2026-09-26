# The website: App Runner running the same container image you can run
# locally. App Runner gives an HTTPS URL, a certificate, a load balancer and
# autoscaling without a VPC, an ALB (about $16/month on its own) or a domain.
# At 0.25 vCPU / 0.5 GB it costs a few dollars a month for a demo.

resource "aws_apprunner_auto_scaling_configuration_version" "web" {
  count = var.web_enabled ? 1 : 0

  auto_scaling_configuration_name = "${var.name}-web"
  min_size                        = 1
  max_size                        = 2
  max_concurrency                 = 50
}

resource "aws_apprunner_service" "web" {
  count = var.web_enabled ? 1 : 0

  service_name                   = "${var.name}-web"
  auto_scaling_configuration_arn = aws_apprunner_auto_scaling_configuration_version.web[0].arn

  source_configuration {
    auto_deployments_enabled = false # deploys are explicit: a new image_tag and `terraform apply`

    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_ecr_access[0].arn
    }

    image_repository {
      image_identifier      = "${aws_ecr_repository.this["web"].repository_url}:${var.image_tag}"
      image_repository_type = "ECR"

      image_configuration {
        port = "3000"

        runtime_environment_variables = {
          NODE_ENV      = "production"
          CIRCUIT_URL   = var.circuit_url
          CIRCUIT_MODEL = var.circuit_model
        }

        # Read from Parameter Store by the instance role at start-up.
        runtime_environment_secrets = {
          CIRCUIT_API_KEY = aws_ssm_parameter.secret["circuit_api_key"].arn
        }
      }
    }
  }

  instance_configuration {
    cpu               = "256" # 0.25 vCPU
    memory            = "512" # 0.5 GB
    instance_role_arn = aws_iam_role.apprunner_instance[0].arn
  }

  health_check_configuration {
    protocol            = "HTTP"
    path                = "/api/classify" # GET returns the service configuration as JSON, no model call
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  network_configuration {
    ip_address_type = "IPV4"

    ingress_configuration {
      is_publicly_accessible = true
    }

    egress_configuration {
      egress_type = "DEFAULT"
    }
  }

  depends_on = [aws_iam_role_policy.apprunner_ecr_access, aws_iam_role_policy.apprunner_instance]
}
