from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import EmailCode, LoyaltyLevel, User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("-date_joined",)
    list_display = ("email", "first_name", "last_name", "role", "email_verified", "is_active", "date_joined")
    list_filter = ("role", "is_active", "email_verified")
    search_fields = ("email", "first_name", "last_name", "phone")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Личные данные", {"fields": ("last_name", "first_name", "middle_name", "phone")}),
        ("Роль и лояльность", {"fields": ("role", "email_verified", "loyalty_level_override")}),
        ("Права", {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")}),
        ("Даты", {"fields": ("last_login", "date_joined")}),
    )
    add_fieldsets = ((None, {"classes": ("wide",), "fields": ("email", "role", "password1", "password2")}),)


@admin.register(LoyaltyLevel)
class LoyaltyLevelAdmin(admin.ModelAdmin):
    list_display = ("name", "min_purchases_amount", "discount_percent")


@admin.register(EmailCode)
class EmailCodeAdmin(admin.ModelAdmin):
    list_display = ("user", "purpose", "created_at", "expires_at", "attempts", "used")
    list_filter = ("purpose", "used")
    readonly_fields = ("code_hash",)
