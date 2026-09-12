resource "google_artifact_registry_repository" "worker" {
  location      = var.region
  repository_id = "${var.name}-worker"
  description   = "Cloud Run worker images"
  format        = "DOCKER"

  depends_on = [google_project_service.this]
}

resource "google_service_account" "worker" {
  account_id   = "slack-ai-worker"
  display_name = "Slack AI Agent Cloud Run worker"
}

resource "google_service_account" "tasks_invoker" {
  account_id   = "slack-ai-tasks"
  display_name = "Cloud Tasks invoker for Cloud Run worker"
}

resource "google_service_account" "webhook_enqueuer" {
  account_id   = "slack-ai-enqueue"
  display_name = "Vercel webhook Cloud Tasks enqueuer"
}

resource "google_service_account_iam_member" "enqueuer_act_as_invoker" {
  service_account_id = google_service_account.tasks_invoker.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.webhook_enqueuer.email}"
}

resource "google_secret_manager_secret_iam_member" "worker" {
  for_each = google_secret_manager_secret.this

  project   = var.project_id
  secret_id = each.value.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_project_iam_member" "worker_logging" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.worker.email}"
}

resource "google_artifact_registry_repository_iam_member" "worker" {
  project    = var.project_id
  location   = google_artifact_registry_repository.worker.location
  repository = google_artifact_registry_repository.worker.repository_id
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${google_service_account.worker.email}"
}
