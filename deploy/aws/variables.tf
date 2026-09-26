variable "aws_region" {
  description = "Region to deploy into. App Runner is not in every region; us-east-1, us-east-2, us-west-2, eu-west-1, eu-central-1, ap-northeast-1 and ap-southeast-2 all work."
  type        = string
  default     = "us-east-1"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]$", var.aws_region))
    error_message = "aws_region must look like us-east-1."
  }
}

variable "name" {
  description = "Prefix for every resource name. Lowercase letters, digits and hyphens."
  type        = string
  default     = "goofy-ahh"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,19}$", var.name))
    error_message = "name must be 3-20 characters: lowercase letters, digits and hyphens, starting with a letter."
  }
}

variable "image_tag" {
  description = "Tag of the images in ECR to run. deploy.sh sets this to the git commit it built."
  type        = string

  validation {
    condition     = can(regex("^[A-Za-z0-9._-]{1,128}$", var.image_tag))
    error_message = "image_tag must be a valid Docker tag."
  }
}

variable "web_enabled" {
  description = "Deploy the website on App Runner. Set false to run only the bot (and host the website elsewhere, e.g. Vercel)."
  type        = bool
  default     = true
}

variable "bot_use_spot" {
  description = "Run the bot task on Fargate Spot (about 70% cheaper; AWS may restart it occasionally, which the bot handles). Set false for on-demand."
  type        = bool
  default     = true
}

variable "container_insights" {
  description = "Turn on ECS Container Insights metrics for the cluster. Useful, but it costs a few dollars a month for a single task, so off by default."
  type        = bool
  default     = false
}

variable "flow_logs_enabled" {
  description = "Record VPC flow logs to CloudWatch. Cents a month at this traffic level and good practice, so on by default."
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "How long CloudWatch keeps container and flow logs."
  type        = number
  default     = 30

  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365], var.log_retention_days)
    error_message = "log_retention_days must be one of CloudWatch's allowed values (1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365)."
  }
}

variable "discord_welcome_channel_id" {
  description = "Channel id for welcome messages. Empty means the server's system channel."
  type        = string
  default     = ""

  validation {
    condition     = var.discord_welcome_channel_id == "" || can(regex("^[0-9]{17,20}$", var.discord_welcome_channel_id))
    error_message = "discord_welcome_channel_id must be a Discord snowflake (17-20 digits) or empty."
  }
}

variable "circuit_url" {
  description = "System One endpoint. The hosted Circuit API by default."
  type        = string
  default     = "https://api.decisioncircuits.com/v1/systemone"

  validation {
    condition     = startswith(var.circuit_url, "https://")
    error_message = "circuit_url must be an https URL: the API key travels with every request."
  }
}

variable "circuit_model" {
  description = "Model name sent in every request."
  type        = string
  default     = "circuit-vl-4b"
}

variable "circuit_min_interval_ms" {
  description = "Minimum gap between the bot's Circuit-VL calls. The free tier allows 60 questions a minute."
  type        = number
  default     = 1100
}
