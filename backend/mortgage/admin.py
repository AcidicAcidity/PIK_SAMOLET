from django.contrib import admin

from .models import MortgageApplication, MortgageProgram


@admin.register(MortgageProgram)
class MortgageProgramAdmin(admin.ModelAdmin):
    list_display = ("bank_name", "name", "rate", "min_down_payment_percent", "max_term_years", "is_active")
    list_filter = ("is_active", "bank_name")


@admin.register(MortgageApplication)
class MortgageApplicationAdmin(admin.ModelAdmin):
    list_display = ("id", "full_name", "program", "loan_amount", "monthly_payment", "status", "created_at")
    list_filter = ("status", "program__bank_name")
    search_fields = ("full_name", "phone", "user__email")
    raw_id_fields = ("user", "apartment", "manager")
