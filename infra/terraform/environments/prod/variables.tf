variable "aws_region" {
  description = "AWS region for Prod"
  type        = string
  default     = "ap-southeast-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "service_names" {
  description = "List of microservices to create"
  type        = list(string)
  default     = ["web", "api", "worker-ingestion", "worker-processing", "worker-ai", "worker-payment"]
}

variable "vpc_cidr" {
  description = "CIDR block for the Prod VPC"
  type        = string
  default     = "10.0.0.0/16"
}
