terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  # For local testing, Dev state can be kept local.
  # In actual team setups, this would point to a separate Dev S3 bucket.
  backend "local" {
    path = "terraform.tfstate"
  }
}

provider "aws" {
  region                      = var.aws_region
  access_key                  = var.use_floci ? "mock" : null
  secret_key                  = var.use_floci ? "mock" : null
  skip_credentials_validation = var.use_floci
  skip_metadata_api_check     = var.use_floci
  skip_requesting_account_id  = var.use_floci
  s3_use_path_style           = var.use_floci

  dynamic "endpoints" {
    for_each = var.use_floci ? [1] : []
    content {
      ec2        = var.floci_endpoint
      ecr        = var.floci_endpoint
      ecs        = var.floci_endpoint
      iam        = var.floci_endpoint
      rds        = var.floci_endpoint
      s3         = var.floci_endpoint
      sts        = var.floci_endpoint
      cloudwatch = var.floci_endpoint
      logs       = var.floci_endpoint
    }
  }
}

