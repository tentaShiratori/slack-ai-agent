module "budget" {
  source = "../modules/budget"

  project_id            = var.project_id
  name                  = var.name
  billing_account_id    = var.billing_account_id
  alert_email           = var.alert_email
  monthly_budget_amount = var.monthly_budget_amount
  budget_currency       = var.budget_currency
}
