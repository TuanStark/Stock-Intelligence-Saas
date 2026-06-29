data "aws_availability_zones" "available" {
  state = "available"
}

# VPC
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "stock-intel-${var.environment}-vpc"
    Environment = var.environment
  }
}

# Public Subnets
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index + 1)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "stock-intel-${var.environment}-public-${data.aws_availability_zones.available.names[count.index]}"
    Environment = var.environment
  }
}

# Private Subnets
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + 10)
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name        = "stock-intel-${var.environment}-private-${data.aws_availability_zones.available.names[count.index]}"
    Environment = var.environment
  }
}

# Internet Gateway
resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name        = "stock-intel-${var.environment}-igw"
    Environment = var.environment
  }
}

# Security Group for NAT Instance
resource "aws_security_group" "nat" {
  name        = "stock-intel-${var.environment}-nat-sg"
  description = "Security group for NAT instance"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from private subnets"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  ingress {
    description = "HTTPS from private subnets"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "stock-intel-${var.environment}-nat-sg"
    Environment = var.environment
  }
}

# NAT Instance EC2 (using standard Amazon Linux 2023 with NAT script, or a community NAT AMI)
resource "aws_instance" "nat" {
  ami                         = "ami-04c913012f8977029" # Standard Amazon Linux 2023 AMI in ap-southeast-1 (or adjust per region)
  instance_type               = "t3.micro"
  subnet_id                   = aws_subnet.public[0].id
  vpc_security_group_ids      = [aws_security_group.nat.id]
  associate_public_ip_address = true
  source_dest_check           = false # Crucial for NAT instance

  # Simple script to enable IP forwarding and NAT masquerading
  user_data = <<-EOF
              #!/bin/bash
              sudo sysctl -w net.ipv4.ip_forward=1
              sudo sh -c "echo 'net.ipv4.ip_forward=1' >> /etc/sysctl.d/custom-ip-forward.conf"
              sudo dnf install iptables -y
              sudo iptables -t nat -A POSTROUTING -o $(ip route show | grep default | awk '{print $5}') -j MASQUERADE
              sudo dnf install iptables-services -y
              sudo service iptables save
              sudo systemctl enable iptables
              EOF

  tags = {
    Name        = "stock-intel-${var.environment}-nat-instance"
    Environment = var.environment
  }
}

# Elastic IP for NAT Instance
resource "aws_eip" "nat" {
  domain   = "vpc"
  instance = aws_instance.nat.id

  tags = {
    Name        = "stock-intel-${var.environment}-nat-eip"
    Environment = var.environment
  }
}

# Public Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gw.id
  }

  tags = {
    Name        = "stock-intel-${var.environment}-public-rt"
    Environment = var.environment
  }
}

# Private Route Table (routes outbound traffic to NAT Instance)
resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block           = "0.0.0.0/0"
    network_interface_id = aws_instance.nat.primary_network_interface_id
  }

  tags = {
    Name        = "stock-intel-${var.environment}-private-rt"
    Environment = var.environment
  }
}

# Route Table Associations - Public
resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Route Table Associations - Private
resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# -------------------------------------------------------------
# VPC Endpoints (PrivateLink) for ECR and S3
# -------------------------------------------------------------

# Security Group for VPC Endpoints
resource "aws_security_group" "vpc_endpoints" {
  name        = "stock-intel-${var.environment}-vpce-sg"
  description = "Security group for VPC Endpoints"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTPS from within VPC"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "stock-intel-${var.environment}-vpce-sg"
    Environment = var.environment
  }
}

# ECR DKR Endpoint (Interface)
resource "aws_vpc_endpoint" "ecr_dkr" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.ap-southeast-1.ecr.dkr"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  subnet_ids          = aws_subnet.private[*].id

  tags = {
    Name        = "stock-intel-${var.environment}-ecr-dkr-vpce"
    Environment = var.environment
  }
}

# ECR API Endpoint (Interface)
resource "aws_vpc_endpoint" "ecr_api" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.ap-southeast-1.ecr.api"
  vpc_endpoint_type   = "Interface"
  private_dns_enabled = true
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  subnet_ids          = aws_subnet.private[*].id

  tags = {
    Name        = "stock-intel-${var.environment}-ecr-api-vpce"
    Environment = var.environment
  }
}

# S3 Gateway Endpoint (Free & Highly Optimized)
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.ap-southeast-1.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = [aws_route_table.private.id, aws_route_table.public.id]

  tags = {
    Name        = "stock-intel-${var.environment}-s3-vpce"
    Environment = var.environment
  }
}
