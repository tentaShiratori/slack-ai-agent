locals {
  worker_image = var.worker_image != "" ? var.worker_image : "us-docker.pkg.dev/cloudrun/container/hello"

  worker_secret_env = merge(
    {
      WORKER_SECRET             = "worker-secret"
      CURSOR_API_KEY            = "cursor-api-key"
      SLACK_BOT_TOKEN           = "slack-bot-token"
      GITHUB_PAT                = "github-pat"
      REDIS_URL                 = "redis-url"
      UPSTASH_REDIS_REST_URL    = "upstash-redis-rest-url"
      UPSTASH_REDIS_REST_TOKEN  = "upstash-redis-rest-token"
      UPSTASH_VECTOR_REST_URL   = "upstash-vector-rest-url"
      UPSTASH_VECTOR_REST_TOKEN = "upstash-vector-rest-token"
    },
    var.sentry_dsn != "" ? { SENTRY_DSN = "sentry-dsn" } : {},
  )
}

resource "google_cloud_run_v2_service" "worker" {
  name     = "${var.name}-worker"
  location = var.region
  project  = var.project_id
  ingress  = "INGRESS_TRAFFIC_ALL"

  deletion_protection = false

  template {
    service_account                  = google_service_account.worker.email
    timeout                          = "3600s"
    max_instance_request_concurrency = 1

    scaling {
      min_instance_count = 0
      max_instance_count = var.worker_max_instances
    }

    containers {
      image = local.worker_image

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "2Gi"
        }
        cpu_idle          = true
        startup_cpu_boost = true
      }

      startup_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 0
        timeout_seconds       = 1
        period_seconds        = 3
        failure_threshold     = 10
      }

      liveness_probe {
        http_get {
          path = "/health"
        }
        initial_delay_seconds = 0
        timeout_seconds       = 1
        period_seconds        = 10
        failure_threshold     = 3
      }

      env {
        name  = "QDRANT_COLLECTION"
        value = upstash_vector_index.wiki.name
      }

      env {
        name  = "SENTRY_ENVIRONMENT"
        value = "production"
      }

      env {
        name  = "SERVICE_NAME"
        value = "worker"
      }

      env {
        name  = "GITHUB_DEFAULT_REPO"
        value = var.github_default_repo
      }

      env {
        name  = "GITHUB_PROJECT_ID"
        value = var.github_project_id
      }

      env {
        name  = "GITHUB_DISCUSSION_CATEGORY_ID"
        value = var.github_discussion_category_id
      }

      dynamic "env" {
        for_each = var.github_discussion_repo != "" ? [var.github_discussion_repo] : []
        content {
          name  = "GITHUB_DISCUSSION_REPO"
          value = env.value
        }
      }

      dynamic "env" {
        for_each = local.worker_secret_env
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.this[env.value].secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  depends_on = [
    google_project_service.this,
    google_secret_manager_secret_version.this,
    google_secret_manager_secret_iam_member.worker,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "tasks_invoker" {
  project  = google_cloud_run_v2_service.worker.project
  location = google_cloud_run_v2_service.worker.location
  name     = google_cloud_run_v2_service.worker.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.tasks_invoker.email}"
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  count = var.allow_unauthenticated ? 1 : 0

  project  = google_cloud_run_v2_service.worker.project
  location = google_cloud_run_v2_service.worker.location
  name     = google_cloud_run_v2_service.worker.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
