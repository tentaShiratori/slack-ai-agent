resource "random_password" "worker_secret" {
  length  = 32
  special = false
}

locals {
  secret_data = merge(
    {
      worker-secret             = random_password.worker_secret.result
      cursor-api-key            = var.cursor_api_key
      slack-bot-token           = var.slack_bot_token
      redis-url                 = local.redis_url
      upstash-redis-rest-url    = local.upstash_redis_rest_url
      upstash-redis-rest-token  = upstash_redis_database.session.rest_token
      upstash-vector-rest-url   = local.upstash_vector_rest_url
      upstash-vector-rest-token = upstash_vector_index.wiki.token
    },
    var.sentry_dsn != "" ? { sentry-dsn = var.sentry_dsn } : {},
  )
}

resource "google_secret_manager_secret" "this" {
  for_each = local.secret_data

  secret_id = "${var.name}-${each.key}"

  replication {
    auto {}
  }

  depends_on = [google_project_service.this]
}

resource "google_secret_manager_secret_version" "this" {
  for_each = local.secret_data

  secret      = google_secret_manager_secret.this[each.key].id
  secret_data = each.value
}
