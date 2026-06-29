output "ecr_repository_urls" {
  description = "URLs of the Dev ECR repositories"
  value       = module.ecr.repository_urls
}

output "vpc_id" {
  description = "The ID of the Dev VPC"
  value       = module.vpc.vpc_id
}
