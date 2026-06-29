variable "aws_region" {
  description = "AWS region for Dev"
  type        = string
  default     = "ap-southeast-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "service_names" {
  description = "List of microservices to create"
  type        = list(string)
  default     = ["web", "api", "worker-ingestion", "worker-processing", "worker-ai", "worker-payment"]
}

variable "vpc_cidr" {
  description = "CIDR block for the Dev VPC"
  type        = string
  default     = "10.1.0.0/16"
}

variable "use_floci" {
  description = "Toggles local emulation using Floci instead of real AWS"
  type        = bool
  default     = true
}

variable "floci_endpoint" {
  description = "Local Floci service endpoint"
  type        = string
  default     = "http://localhost:4566"
}

variable "ecs_ami_id" {
  description = "Custom AMI ID for ECS host (useful for local mock)"
  type        = string
  default     = "ami-mock"
}


