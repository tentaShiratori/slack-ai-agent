output "worker_url" {
  description = "Set this as WORKER_URL on the Vercel webhook"
  value       = google_cloud_run_v2_service.worker.uri
}

output "worker_secret_id" {
  description = "Secret Manager id for WORKER_SECRET. Read with: gcloud secrets versions access latest --secret=NAME"
  value       = google_secret_manager_secret.this["worker-secret"].secret_id
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
