output "ecr_repository_urls" {
  description = "URLs of the Prod ECR repositories"
  value       = module.ecr.repository_urls
}

output "vpc_id" {
  description = "The ID of the Prod VPC"
  value       = module.vpc.vpc_id
}
