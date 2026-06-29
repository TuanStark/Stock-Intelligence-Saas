terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Production state should be stored in S3 for team collaboration & safety
  # backend "s3" {
  #   bucket         = "stock-intel-prod-tfstate"
  #   key            = "production/terraform.tfstate"
  #   region         = "ap-southeast-1"
  #   dynamodb_table = "stock-intel-prod-tflocks"
  #   encrypt        = true
  # }
  
  backend "local" {
    path = "terraform.tfstate"
  }
}

provider "aws" {
  region = var.aws_region
}
