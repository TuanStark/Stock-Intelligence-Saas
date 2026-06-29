resource "aws_db_subnet_group" "db" {
  name       = "stock-intel-${var.environment}-db-subnet-group"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name        = "stock-intel-${var.environment}-db-subnet-group"
    Environment = var.environment
  }
}

# Custom Parameter Group to allow shared_preload_libraries for TimescaleDB
resource "aws_db_parameter_group" "pg" {
  name   = "stock-intel-${var.environment}-pg"
  family = "postgres16"

  parameter {
    name  = "shared_preload_libraries"
    value = "timescaledb"
  }

  tags = {
    Name        = "stock-intel-${var.environment}-pg"
    Environment = var.environment
  }
}

resource "aws_db_instance" "db" {
  identifier             = "stock-intel-${var.environment}-db"
  allocated_storage      = 20
  max_allocated_storage  = 100
  storage_type           = "gp3"
  engine                 = "postgres"
  engine_version         = "16.1"
  instance_class         = "db.t4g.micro" # Free Tier eligible in many regions, or db.t3.micro
  db_name                = "stock_intel_${var.environment}"
  username               = "dbadmin"
  password               = "StockIntelProdPassSecure123" # In prod, this would be fetched from SSM/Secrets Manager
  db_subnet_group_name   = aws_db_subnet_group.db.name
  parameter_group_name   = aws_db_parameter_group.pg.name
  vpc_security_group_ids = [var.rds_sg_id]
  skip_final_snapshot    = true
  publicly_accessible    = false

  tags = {
    Name        = "stock-intel-${var.environment}-db-instance"
    Environment = var.environment
  }
}
