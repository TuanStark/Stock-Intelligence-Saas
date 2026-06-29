variable "service_names" {
  description = "List of microservice names to create ECR repositories for"
  type        = list(string)
  default     = ["web", "api", "worker-ingestion", "worker-processing", "worker-ai", "worker-payment"]
}

variable "environment" {
  description = "Target deployment environment (e.g., prod, staging, dev)"
  type        = string
  default     = "prod"
}
