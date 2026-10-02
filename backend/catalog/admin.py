from django.contrib import admin

from .models import Apartment, ApartmentPhoto, Building, ComplexPhoto, Favorite, ResidentialComplex


class ComplexPhotoInline(admin.TabularInline):
    model = ComplexPhoto
    extra = 1


class ApartmentPhotoInline(admin.TabularInline):
    model = ApartmentPhoto
    extra = 1


class BuildingInline(admin.TabularInline):
    model = Building
    extra = 0


@admin.register(ResidentialComplex)
class ComplexAdmin(admin.ModelAdmin):
    list_display = ("name", "district", "housing_class", "completion_year", "is_published")
    list_filter = ("housing_class", "is_published")
    prepopulated_fields = {"slug": ("name",)}
    inlines = [BuildingInline, ComplexPhotoInline]


@admin.register(Building)
class BuildingAdmin(admin.ModelAdmin):
    list_display = ("__str__", "floors", "stage", "completion_quarter", "construction_progress")
    list_filter = ("complex", "stage")


@admin.register(Apartment)
class ApartmentAdmin(admin.ModelAdmin):
    list_display = ("number", "building", "rooms", "area", "floor", "price", "status", "finishing")
    list_filter = ("status", "rooms", "finishing", "building__complex")
    search_fields = ("number",)
    list_editable = ("price", "status")
    inlines = [ApartmentPhotoInline]


admin.site.register(Favorite)
admin.site.site_header = "Новый Горизонт — администрирование"
admin.site.site_title = "Новый Горизонт"
