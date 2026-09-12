output "worker_url" {
  description = "Cloud Tasks HTTP target (POST /jobs). Set as WORKER_URL on Vercel"
  value       = google_cloud_run_v2_service.worker.uri
}

output "worker_secret_id" {
  description = "Secret Manager id for WORKER_SECRET. Read with: gcloud secrets versions access latest --secret=NAME"
  value       = google_secret_manager_secret.this["worker-secret"].secret_id
}

output "cloud_tasks_queue" {
  description = "Set as CLOUD_TASKS_QUEUE on Vercel"
  value       = google_cloud_tasks_queue.jobs.name
}

output "cloud_tasks_location" {
  description = "Set as CLOUD_TASKS_LOCATION on Vercel"
  value       = google_cloud_tasks_queue.jobs.location
}

output "cloud_tasks_invoker_sa" {
  description = "Set as CLOUD_TASKS_INVOKER_SA on Vercel"
  value       = google_service_account.tasks_invoker.email
}

output "webhook_enqueuer_sa" {
  value = google_service_account.webhook_enqueuer.email
}

output "webhook_enqueuer_key_secret_id" {
  description = "JSON key for GCP_TASKS_SA_KEY. Read with: gcloud secrets versions access latest --secret=NAME"
  value       = google_secret_manager_secret.webhook_enqueuer_key.secret_id
}

output "artifact_registry_repository" {
  description = "Push the worker image here, then set worker_image"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.worker.repository_id}"
}

output "worker_service_account" {
  value = google_service_account.worker.email
}

output "upstash_redis_endpoint" {
  value = upstash_redis_database.session.endpoint
}

output "upstash_vector_endpoint" {
  value = upstash_vector_index.wiki.endpoint
}

output "budget_display_name" {
  description = "Monthly GCP budget alert created in Cloud Billing"
  value       = module.budget.display_name
}
