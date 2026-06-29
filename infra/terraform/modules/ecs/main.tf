# ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "stock-intel-${var.environment}-cluster"

  tags = {
    Name        = "stock-intel-${var.environment}-cluster"
    Environment = var.environment
  }
}

# ECS Container Host IAM Role
resource "aws_iam_role" "ecs_host_role" {
  name = "stock-intel-${var.environment}-ecs-host-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_host" {
  role       = aws_iam_role.ecs_host_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_iam_instance_profile" "ecs_host_profile" {
  name = "stock-intel-${var.environment}-ecs-host-profile"
  role = aws_iam_role.ecs_host_role.name
}

# Look up ECS Optimized AMI dynamically (only if ecs_ami_id is not provided)
data "aws_ami" "ecs_optimized" {
  count       = var.ecs_ami_id == "" ? 1 : 0
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-ecs-hvm-*-x86_64-ebs"]
  }
}

# ECS Container Host (EC2 t3.micro inside Private Subnet)
resource "aws_instance" "ecs_host" {
  ami                  = var.ecs_ami_id != "" ? var.ecs_ami_id : data.aws_ami.ecs_optimized[0].id
  instance_type        = "t3.micro"
  subnet_id            = var.private_subnet_ids[0]
  security_groups      = [var.ecs_sg_id]
  iam_instance_profile = aws_iam_instance_profile.ecs_host_profile.name

  # Register this instance to our ECS Cluster and enable swap space
  user_data = <<-EOF
              #!/bin/bash
              echo "ECS_CLUSTER=${aws_ecs_cluster.main.name}" >> /etc/ecs/ecs.config
              
              # Enable 4GB swap space to handle low memory on t3.micro (1GB RAM)
              dd if=/dev/zero of=/swapfile bs=1M count=4096
              chmod 600 /swapfile
              mkswap /swapfile
              swapon /swapfile
              echo "/swapfile swap swap defaults 0 0" >> /etc/fstab
              EOF

  tags = {
    Name        = "stock-intel-${var.environment}-ecs-host"
    Environment = var.environment
  }
}

# -------------------------------------------------------------
# ECS Task Definitions and Services
# -------------------------------------------------------------

# Helper local for defining task configuration and memory limits
locals {
  services_config = {
    api = {
      cpu    = 256
      memory = 200
      port   = 3001
    }
    web = {
      cpu    = 256
      memory = 200
      port   = 3000
    }
    worker-ingestion = {
      cpu    = 128
      memory = 80
      port   = 0
    }
    worker-processing = {
      cpu    = 128
      memory = 80
      port   = 0
    }
    worker-ai = {
      cpu    = 128
      memory = 80
      port   = 0
    }
    worker-payment = {
      cpu    = 128
      memory = 80
      port   = 0
    }
  }
}

# Task Definition & Service for custom microservices (using ECR)
resource "aws_ecs_task_definition" "app" {
  for_each                 = local.services_config
  family                   = "stock-intel-${var.environment}-${each.key}"
  network_mode             = "bridge"
  requires_compatibilities = ["EC2"]
  execution_role_arn       = var.execution_role_arn
  task_role_arn            = var.task_role_arn

  container_definitions = jsonencode([
    {
      name      = "stock-intel-${each.key}"
      image     = "${var.ecr_repository_urls[each.key]}:latest"
      cpu       = each.value.cpu
      memory    = each.value.memory
      essential = true

      portMappings = each.value.port > 0 ? [
        {
          containerPort = each.value.port
          hostPort      = each.value.port
          protocol      = "tcp"
        }
      ] : []

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/stock-intel-${var.environment}"
          "awslogs-region"        = "ap-southeast-1"
          "awslogs-stream-prefix" = each.key
        }
      }
    }
  ])
}

resource "aws_ecs_service" "app" {
  for_each        = local.services_config
  name            = "stock-intel-${each.key}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app[each.key].arn
  desired_count   = 1
  launch_type     = "EC2"

  # Force deployment of new tasks when definition updates
  force_new_deployment = true
}

# -------------------------------------------------------------
# Redis Task & Service
# -------------------------------------------------------------
resource "aws_ecs_task_definition" "redis" {
  family                   = "stock-intel-${var.environment}-redis"
  network_mode             = "bridge"
  requires_compatibilities = ["EC2"]
  execution_role_arn       = var.execution_role_arn

  container_definitions = jsonencode([
    {
      name      = "redis"
      image     = "redis:7-alpine"
      cpu       = 128
      memory    = 128
      essential = true

      portMappings = [
        {
          containerPort = 6379
          hostPort      = 6379
          protocol      = "tcp"
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/stock-intel-${var.environment}"
          "awslogs-region"        = "ap-southeast-1"
          "awslogs-stream-prefix" = "redis"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "redis" {
  name            = "stock-intel-redis"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.redis.arn
  desired_count   = 1
  launch_type     = "EC2"
}

# Cloudwatch Logs Group for all services in this cluster
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/ecs/stock-intel-${var.environment}"
  retention_in_days = 7
}
