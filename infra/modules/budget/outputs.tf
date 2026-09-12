output "display_name" {
  description = "Monthly GCP budget alert created in Cloud Billing"
  value       = google_billing_budget.monthly.display_name
}
