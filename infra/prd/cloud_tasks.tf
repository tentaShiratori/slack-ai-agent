resource "google_cloud_tasks_queue" "jobs" {
  name     = "${var.name}-jobs"
  location = var.region
  project  = var.project_id

  rate_limits {
    max_concurrent_dispatches = var.worker_max_instances
    max_dispatches_per_second = 5
  }

  retry_config {
    max_attempts       = 5
    max_retry_duration = "3600s"
    min_backoff        = "10s"
    max_backoff        = "300s"
    max_doublings      = 4
  }

  depends_on = [google_project_service.this]
}

resource "google_cloud_tasks_queue_iam_member" "enqueuer" {
  project  = var.project_id
  location = google_cloud_tasks_queue.jobs.location
  name     = google_cloud_tasks_queue.jobs.name
  role     = "roles/cloudtasks.enqueuer"
  member   = "serviceAccount:${google_service_account.webhook_enqueuer.email}"
}

resource "google_service_account_key" "webhook_enqueuer" {
  service_account_id = google_service_account.webhook_enqueuer.name
}

resource "google_secret_manager_secret" "webhook_enqueuer_key" {
  secret_id = "${var.name}-webhook-enqueuer-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.this]
}

resource "google_secret_manager_secret_version" "webhook_enqueuer_key" {
  secret      = google_secret_manager_secret.webhook_enqueuer_key.id
  secret_data = base64decode(google_service_account_key.webhook_enqueuer.private_key)
}
