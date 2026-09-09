provider "google" {
  project = var.project_id
  region  = var.region
}

provider "upstash" {
  email   = var.upstash_email
  api_key = var.upstash_api_key
}

provider "aws" {
  region  = "ap-northeast-1"
}