variable "vpc_id" {
  description = "The ID of the VPC"
  type        = string
}

variable "private_subnet_ids" {
  description = "IDs of the private subnets"
  type        = list(string)
}

variable "public_subnet_ids" {
  description = "IDs of the public subnets"
  type        = list(string)
}

variable "ecs_sg_id" {
  description = "Security Group ID for ECS host instances"
  type        = string
}

variable "alb_sg_id" {
  description = "Security Group ID for the ALB"
  type        = string
}

variable "execution_role_arn" {
  description = "ARN of the ECS task execution role"
  type        = string
}

variable "task_role_arn" {
  description = "ARN of the ECS task role"
  type        = string
}

variable "ecr_repository_urls" {
  description = "Map of microservice names to ECR repository URLs"
  type        = map(string)
}

variable "environment" {
  description = "Target deployment environment"
  type        = string
  default     = "prod"
}

variable "ecs_ami_id" {
  description = "Optional custom AMI ID for ECS host. If empty, queries AWS dynamically."
  type        = string
  default     = ""
}

