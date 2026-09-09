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

  # 状態を GCS に置く場合はコメントを外す。
  # backend "gcs" {
  #   bucket = "YOUR_TFSTATE_BUCKET"
  #   prefix = "slack-ai-agent/prd"
  # }
}
