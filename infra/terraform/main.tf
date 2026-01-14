terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.region
}

variable "region" { type = string default = "us-east-1" }
variable "project" { type = string default = "makerkit" }

# S3 bucket for artifacts
resource "aws_s3_bucket" "artifacts" {
  bucket = "${var.project}-artifacts-${random_id.rand.hex}"
  force_destroy = true
  tags = { Project = var.project }
}

resource "random_id" "rand" { byte_length = 4 }

# Secrets Manager placeholders
resource "aws_secretsmanager_secret" "supabase" { name = "${var.project}/supabase/key" }
resource "aws_secretsmanager_secret" "mlflow" { name = "${var.project}/mlflow/uri" }

# ECR repositories (api, diffusion)
resource "aws_ecr_repository" "api" { name = "${var.project}-api" }
resource "aws_ecr_repository" "diffusion" { name = "${var.project}-diffusion" }

output "artifact_bucket" { value = aws_s3_bucket.artifacts.bucket }
output "ecr_api" { value = aws_ecr_repository.api.repository_url }
output "ecr_diffusion" { value = aws_ecr_repository.diffusion.repository_url }
