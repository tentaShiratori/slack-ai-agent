variable "project_id" {
  type        = string
  description = "GCP project ID to attach the budget to"
}

variable "name" {
  type        = string
  description = "Resource name prefix"
}

variable "billing_account_id" {
  type        = string
  description = "Cloud Billing account ID (XXXXXX-XXXXXX-XXXXXX)"
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
