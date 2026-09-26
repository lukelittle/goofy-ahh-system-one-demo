# One private registry repository per image. Tags are immutable (a tag is a
# specific build forever), every push is scanned for known CVEs, and old
# images are expired so storage stays at cents.

locals {
  repositories = {
    web = "the Next.js website"
    bot = "the Discord bot"
  }
}

resource "aws_ecr_repository" "this" {
  for_each = local.repositories

  #checkov:skip=CKV_AWS_136: AES-256 encryption at rest with an AWS-owned key; a customer KMS key costs $1/month and protects nothing extra for public-source images.
  name                 = "${var.name}/${each.key}"
  image_tag_mutability = "IMMUTABLE"
  force_delete         = true # lets `terraform destroy` remove the repo even with images in it

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = { Description = each.value }
}

resource "aws_ecr_lifecycle_policy" "this" {
  for_each = aws_ecr_repository.this

  repository = each.value.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "keep the last 5 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = { type = "expire" }
    }]
  })
}
