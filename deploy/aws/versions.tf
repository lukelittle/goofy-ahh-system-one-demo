terraform {
  required_version = ">= 1.9.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # State is local by default so the demo needs nothing set up in advance.
  # For anything shared, move it to S3 (see README, "Remote state").
}
