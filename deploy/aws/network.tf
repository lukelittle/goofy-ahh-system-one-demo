# A small dedicated VPC: two public subnets in two AZs and an internet
# gateway. There is no NAT gateway on purpose (about $32/month, more than
# everything else here combined). The bot task gets a public IP instead,
# with a security group that allows no inbound traffic at all, and outbound
# only to HTTPS and DNS. Nothing in this VPC listens for connections.

data "aws_availability_zones" "available" {
  #checkov:skip=CKV_AWS_394: only the first two names (sorted) are used, so a new AZ appended to the region cannot change which subnets exist.
  state = "available"

  filter {
    name   = "zone-type"
    values = ["availability-zone"] # not Local Zones or Wavelength Zones
  }
}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
}

resource "aws_vpc" "this" {
  cidr_block           = "10.42.0.0/24"
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = var.name }
}

# Adopting the default security group and giving it no rules disables it.
resource "aws_default_security_group" "this" {
  vpc_id = aws_vpc.this.id

  tags = { Name = "${var.name}-default-locked" }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = { Name = var.name }
}

resource "aws_subnet" "public" {
  count = 2

  vpc_id                  = aws_vpc.this.id
  cidr_block              = cidrsubnet(aws_vpc.this.cidr_block, 2, count.index)
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = false # the ECS service asks for its own IP explicitly

  tags = { Name = "${var.name}-public-${count.index}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = { Name = "${var.name}-public" }
}

resource "aws_route_table_association" "public" {
  count = 2

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "bot" {
  name_prefix = "${var.name}-bot-"
  description = "Discord bot task: no inbound; outbound HTTPS (Discord gateway, Circuit API, ECR, CloudWatch) and DNS only"
  vpc_id      = aws_vpc.this.id

  tags = { Name = "${var.name}-bot" }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_vpc_security_group_egress_rule" "bot_https" {
  security_group_id = aws_security_group.bot.id
  description       = "HTTPS to the internet: Discord gateway and API, the Circuit endpoint, ECR image pulls, CloudWatch Logs"
  ip_protocol       = "tcp"
  from_port         = 443
  to_port           = 443
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_vpc_security_group_egress_rule" "bot_dns_udp" {
  security_group_id = aws_security_group.bot.id
  description       = "DNS to the VPC resolver"
  ip_protocol       = "udp"
  from_port         = 53
  to_port           = 53
  cidr_ipv4         = aws_vpc.this.cidr_block
}

resource "aws_vpc_security_group_egress_rule" "bot_dns_tcp" {
  security_group_id = aws_security_group.bot.id
  description       = "DNS to the VPC resolver (large responses)"
  ip_protocol       = "tcp"
  from_port         = 53
  to_port           = 53
  cidr_ipv4         = aws_vpc.this.cidr_block
}

# Flow logs: who talked to what. At this traffic level they cost cents.
resource "aws_cloudwatch_log_group" "flow_logs" {
  count = var.flow_logs_enabled ? 1 : 0

  #checkov:skip=CKV_AWS_338: retention is var.log_retention_days (30 by default); a year of demo logs is cost without purpose. Raise it for anything real.
  #checkov:skip=CKV_AWS_158: CloudWatch encrypts log data at rest by default; a customer KMS key adds $1/month for no change in this threat model.
  name              = "/aws/vpc/${var.name}-flow-logs"
  retention_in_days = var.log_retention_days
}

data "aws_iam_policy_document" "flow_logs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["vpc-flow-logs.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "aws:SourceAccount"
      values   = [data.aws_caller_identity.current.account_id]
    }
  }
}

data "aws_iam_policy_document" "flow_logs" {
  count = var.flow_logs_enabled ? 1 : 0

  statement {
    actions   = ["logs:CreateLogStream", "logs:PutLogEvents", "logs:DescribeLogStreams"]
    resources = ["${aws_cloudwatch_log_group.flow_logs[0].arn}:*"]
  }
}

resource "aws_iam_role" "flow_logs" {
  count = var.flow_logs_enabled ? 1 : 0

  name_prefix        = "${var.name}-flow-logs-"
  assume_role_policy = data.aws_iam_policy_document.flow_logs_assume.json
}

resource "aws_iam_role_policy" "flow_logs" {
  count = var.flow_logs_enabled ? 1 : 0

  name   = "write-flow-logs"
  role   = aws_iam_role.flow_logs[0].id
  policy = data.aws_iam_policy_document.flow_logs[0].json
}

resource "aws_flow_log" "this" {
  count = var.flow_logs_enabled ? 1 : 0

  vpc_id          = aws_vpc.this.id
  traffic_type    = "ALL"
  log_destination = aws_cloudwatch_log_group.flow_logs[0].arn
  iam_role_arn    = aws_iam_role.flow_logs[0].arn

  tags = { Name = var.name }
}
