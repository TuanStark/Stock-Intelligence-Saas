module "ecr" {
  source        = "../../modules/ecr"
  service_names = var.service_names
  environment   = var.environment
}

module "vpc" {
  source      = "../../modules/vpc"
  vpc_cidr    = var.vpc_cidr
  environment = var.environment
}

module "security_groups" {
  source      = "../../modules/security_groups"
  vpc_id      = module.vpc.vpc_id
  environment = var.environment
}

module "iam" {
  source      = "../../modules/iam"
  environment = var.environment
}

module "s3" {
  source      = "../../modules/s3"
  environment = var.environment
}

module "rds" {
  source             = "../../modules/rds"
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  rds_sg_id          = module.security_groups.rds_sg_id
  environment        = var.environment
}

module "ecs" {
  source              = "../../modules/ecs"
  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnet_ids
  public_subnet_ids   = module.vpc.public_subnet_ids
  ecs_sg_id           = module.security_groups.ecs_sg_id
  alb_sg_id           = module.security_groups.alb_sg_id
  execution_role_arn  = module.iam.ecs_execution_role_arn
  task_role_arn       = module.iam.ecs_task_role_arn
  ecr_repository_urls = module.ecr.repository_urls
  environment         = var.environment
}
