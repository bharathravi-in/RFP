# ============================================================================
# Cloud-Agnostic Infrastructure as Code
# 
# This Terraform configuration demonstrates provider-neutral patterns for:
# - VPC/Network abstraction
# - Managed database hints
# - Storage abstraction
# - Kubernetes cluster
# - Secrets management
#
# Usage:
#   terraform init
#   terraform plan -var="cloud_provider=aws"  # or gcp or azure
#   terraform apply
# ============================================================================

terraform {
  required_version = ">= 1.0.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
  }
}

# ============================================================================
# Variables - Cloud-Agnostic Configuration
# ============================================================================

variable "cloud_provider" {
  description = "Cloud provider to deploy to: aws, gcp, or azure"
  type        = string
  default     = "aws"
  
  validation {
    condition     = contains(["aws", "gcp", "azure"], var.cloud_provider)
    error_message = "cloud_provider must be one of: aws, gcp, azure"
  }
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "rfp-system"
}

variable "region" {
  description = "Deployment region (cloud-agnostic naming)"
  type        = string
  default     = "us-east-1"  # Will be mapped to cloud-specific region
}

# Region mapping for multi-cloud
locals {
  region_map = {
    "us-east-1" = {
      aws   = "us-east-1"
      gcp   = "us-east1"
      azure = "eastus"
    }
    "us-west-2" = {
      aws   = "us-west-2"
      gcp   = "us-west1"
      azure = "westus2"
    }
    "eu-west-1" = {
      aws   = "eu-west-1"
      gcp   = "europe-west1"
      azure = "westeurope"
    }
  }
  
  actual_region = local.region_map[var.region][var.cloud_provider]
  
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# ============================================================================
# Network Module - VPC/VNet Abstraction
# ============================================================================

module "network" {
  source = "./modules/network"
  
  cloud_provider = var.cloud_provider
  region         = local.actual_region
  project_name   = var.project_name
  environment    = var.environment
  
  vpc_cidr = "10.0.0.0/16"
  
  # Subnet configuration (cloud-agnostic)
  subnets = {
    public = {
      cidrs = ["10.0.1.0/24", "10.0.2.0/24"]
      type  = "public"
    }
    private = {
      cidrs = ["10.0.10.0/24", "10.0.11.0/24"]
      type  = "private"
    }
    database = {
      cidrs = ["10.0.20.0/24", "10.0.21.0/24"]
      type  = "isolated"
    }
  }
}

# ============================================================================
# Database Module - Managed PostgreSQL Abstraction
# ============================================================================

module "database" {
  source = "./modules/database"
  
  cloud_provider = var.cloud_provider
  region         = local.actual_region
  project_name   = var.project_name
  environment    = var.environment
  
  # Cloud-agnostic database configuration
  database_config = {
    engine         = "postgresql"
    engine_version = "15"
    instance_class = "small"  # Maps to: db.t3.small / db-custom-1-3840 / GP_Gen5_2
    storage_gb     = 20
    multi_az       = var.environment == "prod"
  }
  
  database_name = "rfp_database"
  
  # Network configuration
  vpc_id           = module.network.vpc_id
  subnet_ids       = module.network.database_subnet_ids
  security_group_id = module.network.database_security_group_id
}

# ============================================================================
# Storage Module - Object Storage Abstraction
# ============================================================================

module "storage" {
  source = "./modules/storage"
  
  cloud_provider = var.cloud_provider
  region         = local.actual_region
  project_name   = var.project_name
  environment    = var.environment
  
  # Cloud-agnostic bucket configuration
  buckets = {
    documents = {
      name = "${var.project_name}-documents-${var.environment}"
      versioning = true
      lifecycle_rules = [
        {
          prefix = "temp/"
          expiration_days = 30
        }
      ]
    }
    exports = {
      name = "${var.project_name}-exports-${var.environment}"
      versioning = false
    }
  }
}

# ============================================================================
# Cache Module - Redis Abstraction
# ============================================================================

module "cache" {
  source = "./modules/cache"
  
  cloud_provider = var.cloud_provider
  region         = local.actual_region
  project_name   = var.project_name
  environment    = var.environment
  
  cache_config = {
    engine       = "redis"
    node_type    = "small"  # Maps to: cache.t3.small / redis-standard / C1
    num_nodes    = var.environment == "prod" ? 3 : 1
    version      = "7.0"
  }
  
  vpc_id    = module.network.vpc_id
  subnet_ids = module.network.private_subnet_ids
}

# ============================================================================
# Kubernetes Module - Managed K8s Abstraction
# ============================================================================

module "kubernetes" {
  source = "./modules/kubernetes"
  
  cloud_provider = var.cloud_provider
  region         = local.actual_region
  project_name   = var.project_name
  environment    = var.environment
  
  cluster_config = {
    version   = "1.28"
    node_pools = {
      default = {
        machine_type = "medium"  # Maps to: t3.medium / e2-medium / Standard_D2_v3
        min_nodes    = 2
        max_nodes    = 10
        disk_size_gb = 50
      }
      gpu = {
        machine_type = "gpu"  # Maps to GPU instances
        min_nodes    = 0
        max_nodes    = 2
        disk_size_gb = 100
        gpu_type     = "nvidia-tesla-t4"
      }
    }
  }
  
  vpc_id     = module.network.vpc_id
  subnet_ids = module.network.private_subnet_ids
}

# ============================================================================
# Secrets Module - Secrets Manager Abstraction
# ============================================================================

module "secrets" {
  source = "./modules/secrets"
  
  cloud_provider = var.cloud_provider
  region         = local.actual_region
  project_name   = var.project_name
  environment    = var.environment
  
  # Secrets to create (values injected at apply time)
  secrets = {
    "database-credentials" = {
      description = "Database credentials"
      # Value provided via sensitive variable or external secret
    }
    "llm-api-keys" = {
      description = "LLM provider API keys"
    }
    "jwt-secret" = {
      description = "JWT signing secret"
    }
  }
}

# ============================================================================
# Vector Database Module - Qdrant/Managed Vector DB
# ============================================================================

module "vectordb" {
  source = "./modules/vectordb"
  
  cloud_provider = var.cloud_provider
  region         = local.actual_region
  project_name   = var.project_name
  environment    = var.environment
  
  # Self-hosted Qdrant on K8s or managed service
  deployment_type = "kubernetes"  # or "managed" for Pinecone/Qdrant Cloud
  
  qdrant_config = {
    replicas   = var.environment == "prod" ? 3 : 1
    storage_gb = 50
  }
  
  kubernetes_namespace = "vector-db"
  
  depends_on = [module.kubernetes]
}

# ============================================================================
# Outputs - Unified Interface
# ============================================================================

output "cloud_provider" {
  description = "Selected cloud provider"
  value       = var.cloud_provider
}

output "network" {
  description = "Network configuration"
  value = {
    vpc_id              = module.network.vpc_id
    public_subnet_ids   = module.network.public_subnet_ids
    private_subnet_ids  = module.network.private_subnet_ids
    database_subnet_ids = module.network.database_subnet_ids
  }
}

output "database" {
  description = "Database connection info"
  sensitive   = true
  value = {
    host     = module.database.host
    port     = module.database.port
    database = module.database.database_name
    # Credentials in secrets manager
    secret_arn = module.secrets.secret_arns["database-credentials"]
  }
}

output "storage" {
  description = "Storage bucket info"
  value = {
    documents_bucket = module.storage.bucket_names["documents"]
    exports_bucket   = module.storage.bucket_names["exports"]
  }
}

output "cache" {
  description = "Cache connection info"
  value = {
    host = module.cache.host
    port = module.cache.port
  }
}

output "kubernetes" {
  description = "Kubernetes cluster info"
  value = {
    cluster_name     = module.kubernetes.cluster_name
    cluster_endpoint = module.kubernetes.cluster_endpoint
    # kubeconfig retrieved via cloud CLI
  }
}

output "vectordb" {
  description = "Vector database info"
  value = {
    host = module.vectordb.host
    port = module.vectordb.port
  }
}

# ============================================================================
# Example Network Module (./modules/network/main.tf)
# ============================================================================

# NOTE: This is a pseudo-module showing the pattern.
# In practice, each module would have cloud-specific implementations.

/*
# modules/network/main.tf

variable "cloud_provider" {}
variable "region" {}
variable "project_name" {}
variable "environment" {}
variable "vpc_cidr" {}
variable "subnets" {}

# AWS Implementation
resource "aws_vpc" "main" {
  count = var.cloud_provider == "aws" ? 1 : 0
  cidr_block = var.vpc_cidr
  tags = { Name = "${var.project_name}-vpc" }
}

# GCP Implementation
resource "google_compute_network" "main" {
  count = var.cloud_provider == "gcp" ? 1 : 0
  name = "${var.project_name}-vpc"
  auto_create_subnetworks = false
}

# Azure Implementation
resource "azurerm_virtual_network" "main" {
  count = var.cloud_provider == "azure" ? 1 : 0
  name = "${var.project_name}-vnet"
  address_space = [var.vpc_cidr]
  location = var.region
}

# Unified outputs
output "vpc_id" {
  value = coalesce(
    try(aws_vpc.main[0].id, null),
    try(google_compute_network.main[0].id, null),
    try(azurerm_virtual_network.main[0].id, null)
  )
}
*/

# ============================================================================
# Instance Size Mapping
# ============================================================================

# This local block shows how to map abstract sizes to cloud-specific instances
locals {
  instance_size_map = {
    small = {
      aws   = "t3.small"
      gcp   = "e2-small"
      azure = "Standard_B1ms"
    }
    medium = {
      aws   = "t3.medium"
      gcp   = "e2-medium"
      azure = "Standard_D2_v3"
    }
    large = {
      aws   = "t3.large"
      gcp   = "e2-standard-2"
      azure = "Standard_D4_v3"
    }
    gpu = {
      aws   = "g4dn.xlarge"
      gcp   = "n1-standard-4"  # + GPU attachment
      azure = "Standard_NC6"
    }
  }
  
  db_instance_size_map = {
    small = {
      aws   = "db.t3.small"
      gcp   = "db-custom-1-3840"
      azure = "GP_Gen5_2"
    }
    medium = {
      aws   = "db.t3.medium"
      gcp   = "db-custom-2-7680"
      azure = "GP_Gen5_4"
    }
    large = {
      aws   = "db.r5.large"
      gcp   = "db-custom-4-15360"
      azure = "GP_Gen5_8"
    }
  }
  
  cache_instance_size_map = {
    small = {
      aws   = "cache.t3.small"
      gcp   = "redis-standard"
      azure = "C1"
    }
    medium = {
      aws   = "cache.t3.medium"
      gcp   = "redis-standard"
      azure = "C2"
    }
  }
}
