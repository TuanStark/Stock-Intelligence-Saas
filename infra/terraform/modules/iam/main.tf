# ECS Task Execution Role (used by ECS agent to pull images, write logs, read SSM secrets)
resource "aws_iam_role" "ecs_execution_role" {
  name = "stock-intel-${var.environment}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "stock-intel-ecs-execution-role"
    Environment = var.environment
  }
}

# Attach standard AWS policy for ECS task execution (ECR, CloudWatch Logs)
resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Custom policy for ECS Execution Role to access SSM Parameter Store
resource "aws_iam_policy" "ecs_execution_ssm" {
  name        = "stock-intel-${var.environment}-ecs-execution-ssm"
  description = "Allows ECS Execution Role to read parameters from SSM Parameter Store"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssm:GetParameters",
          "ssm:GetParameter",
          "ssm:GetParametersByPath"
        ]
        Resource = "arn:aws:ssm:*:*:parameter/stock-intel/${var.environment}/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_ssm" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = aws_iam_policy.ecs_execution_ssm.arn
}

# ECS Task Role (used by the application container itself, e.g. to write to S3)
resource "aws_iam_role" "ecs_task_role" {
  name = "stock-intel-${var.environment}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "stock-intel-ecs-task-role"
    Environment = var.environment
  }
}

# Custom policy for S3 Access by application tasks
resource "aws_iam_policy" "ecs_task_s3" {
  name        = "stock-intel-${var.environment}-ecs-task-s3"
  description = "Allows ECS Tasks to read and write to the application S3 Bucket"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket",
          "s3:DeleteObject"
        ]
        Resource = [
          "arn:aws:s3:::stock-intel-${var.environment}-*",
          "arn:aws:s3:::stock-intel-${var.environment}-*/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_s3" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.ecs_task_s3.arn
}
