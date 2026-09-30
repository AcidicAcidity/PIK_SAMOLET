from django.contrib import admin

from .models import Booking


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "apartment", "status", "final_price", "manager", "created_at")
    list_filter = ("status", "payment_method")
    search_fields = ("user__email", "apartment__number")
    raw_id_fields = ("user", "apartment", "manager")
