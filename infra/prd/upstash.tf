resource "upstash_redis_database" "session" {
  database_name  = "${var.name}-session"
  region         = "global"
  primary_region = var.upstash_redis_primary_region
  tls            = true
  eviction       = true
}

resource "upstash_vector_index" "wiki" {
  name                = "${var.name}-wiki"
  region              = var.upstash_vector_region
  similarity_function = "COSINE"
  dimension_count     = var.vector_dimension_count
  type                = var.upstash_vector_plan
}

locals {
  redis_url               = "rediss://default:${upstash_redis_database.session.password}@${upstash_redis_database.session.endpoint}:${upstash_redis_database.session.port}"
  upstash_redis_rest_url  = "https://${upstash_redis_database.session.endpoint}"
  upstash_vector_rest_url = startswith(upstash_vector_index.wiki.endpoint, "https://") ? upstash_vector_index.wiki.endpoint : "https://${upstash_vector_index.wiki.endpoint}"
}
