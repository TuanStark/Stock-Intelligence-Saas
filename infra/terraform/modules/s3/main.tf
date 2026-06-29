resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "app_storage" {
  bucket        = "stock-intel-${var.environment}-storage-${random_id.bucket_suffix.hex}"
  force_destroy = true

  tags = {
    Name        = "stock-intel-${var.environment}-storage"
    Environment = var.environment
  }
}

# Block public access to the bucket
resource "aws_s3_bucket_public_access_block" "app_storage_block" {
  bucket = aws_s3_bucket.app_storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
