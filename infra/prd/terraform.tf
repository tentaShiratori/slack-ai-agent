terraform {
  required_version = ">= 1.8.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.47"
    }
    upstash = {
      source  = "upstash/upstash"
      version = "~> 2.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.7"
    }
  }

  backend "s3" {
    bucket = "tenta-tfstate"
    key    = "slack-ai-agent/prd"
    region = "ap-northeast-1"
  }
}
