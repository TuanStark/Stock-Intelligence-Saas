variable "vpc_id" {
  description = "The ID of the VPC"
  type        = string
}

variable "environment" {
  description = "Target deployment environment"
  type        = string
  default     = "prod"
}
