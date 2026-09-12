variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type        = string
  description = "GCP region for Cloud Run, Artifact Registry, and Secret Manager"
  default     = "asia-northeast1"
}

variable "name" {
  type        = string
  description = "Resource name prefix"
  default     = "slack-ai-agent"
}

variable "upstash_email" {
  type        = string
  description = "Upstash console account email"
}

variable "upstash_api_key" {
  type        = string
  sensitive   = true
  description = "Upstash Management API key"
}

variable "upstash_redis_primary_region" {
  type        = string
  description = "Upstash global Redis primary region (Tokyo is not in the provider allowlist)"
  default     = "ap-southeast-1"
}

variable "upstash_vector_region" {
  type        = string
  description = "Upstash Vector region"
  default     = "us-east-1"
}

variable "upstash_vector_plan" {
  type        = string
  description = "Upstash Vector plan: free, paid, fixed, or pro"
  default     = "free"
}

variable "vector_dimension_count" {
  type        = number
  description = "Embedding dimension. Match the model used to index wiki chunks"
  default     = 384
}

variable "cursor_api_key" {
  type        = string
  sensitive   = true
  description = "Cursor API key stored in Secret Manager"
}

variable "slack_bot_token" {
  type        = string
  sensitive   = true
  description = "Slack bot token stored in Secret Manager"
}

variable "worker_image" {
  type        = string
  default     = ""
  description = "Worker image URI. Empty uses the Cloud Run hello sample until the real image is pushed"
}

variable "worker_max_instances" {
  type        = number
  default     = 5
  description = "Cloud Run max instances"
}

variable "allow_unauthenticated" {
  type        = bool
  default     = false
  description = "Allow public Cloud Run invoke. Production uses Cloud Tasks OIDC; keep false unless debugging"
}

variable "github_pat" {
  type        = string
  sensitive   = true
  description = "Fine-grained PAT for Issues, Projects, and Discussions"
}

variable "github_default_repo" {
  type        = string
  description = "Default owner/repo for Issues"
}

variable "github_project_id" {
  type        = string
  description = "GitHub Project v2 node id (PVT_...)"
}

variable "github_discussion_category_id" {
  type        = string
  description = "Discussion category node id (DIC_...)"
}

variable "github_discussion_repo" {
  type        = string
  default     = ""
  description = "owner/repo for Discussions. Empty uses github_default_repo"
}

variable "sentry_dsn" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Sentry DSN for the worker. Empty disables Sentry"
}

variable "billing_account_id" {
  type        = string
  description = "Cloud Billing account ID (XXXXXX-XXXXXX-XXXXXX) for the monthly budget alert"
}

variable "alert_email" {
  type        = string
  description = "Email for GCP budget alerts"
}

variable "monthly_budget_amount" {
  type        = number
  default     = 10
  description = "Monthly budget amount in budget_currency"
}

variable "budget_currency" {
  type        = string
  default     = "USD"
  description = "Must match the billing account currency"
}
