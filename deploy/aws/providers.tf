provider "aws" {
  region = var.aws_region

  # Every resource gets these tags, so the bill and the console both show
  # what belongs to this demo, and `terraform destroy` is the only cleanup.
  default_tags {
    tags = {
      Project   = var.name
      ManagedBy = "terraform"
      Source    = "github.com/lukelittle/goofy-ahh-system-one-demo"
    }
  }
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}
