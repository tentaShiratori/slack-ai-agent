resource "random_password" "worker_secret" {
  length  = 32
  special = false
}

resource "google_secret_manager_secret" "this" {
  for_each = toset([
    "worker-secret",
    "anthropic-api-key",
    "slack-bot-token",
    "redis-url",
    "upstash-redis-rest-url",
    "upstash-redis-rest-token",
    "upstash-vector-rest-url",
    "upstash-vector-rest-token",
  ])

  secret_id = "${var.name}-${each.value}"

  replication {
    auto {}
  }

  depends_on = [google_project_service.this]
}

resource "google_secret_manager_secret_version" "this" {
  for_each = {
    worker-secret             = random_password.worker_secret.result
    anthropic-api-key         = var.anthropic_api_key
    slack-bot-token           = var.slack_bot_token
    redis-url                 = local.redis_url
    upstash-redis-rest-url    = local.upstash_redis_rest_url
    upstash-redis-rest-token  = upstash_redis_database.session.rest_token
    upstash-vector-rest-url   = local.upstash_vector_rest_url
    upstash-vector-rest-token = upstash_vector_index.wiki.token
  }

  secret      = google_secret_manager_secret.this[each.key].id
  secret_data = each.value
}
