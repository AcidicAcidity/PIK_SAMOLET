from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve
from rest_framework.routers import DefaultRouter

from accounts.views import AdminUserViewSet, LoyaltyLevelViewSet, LoyaltyStatusView
from bookings.views import ManagerBookingViewSet, MyBookingViewSet
from catalog.views import ApartmentViewSet, BuildingViewSet, CompareView, ComplexViewSet, FavoriteViewSet
from core.views import CompanyView, LeadCreateView, ManagerLeadViewSet, ManagerStatsView, NewsViewSet
from mortgage.views import CalculatorView, ManagerApplicationViewSet, MyApplicationViewSet, ProgramViewSet

router = DefaultRouter()
router.register("complexes", ComplexViewSet, basename="complex")
router.register("buildings", BuildingViewSet, basename="building")
router.register("apartments", ApartmentViewSet, basename="apartment")
router.register("favorites", FavoriteViewSet, basename="favorite")
router.register("bookings", MyBookingViewSet, basename="booking")
router.register("news", NewsViewSet, basename="news")
router.register("loyalty/levels", LoyaltyLevelViewSet, basename="loyalty-level")
router.register("mortgage/programs", ProgramViewSet, basename="mortgage-program")
router.register("mortgage/applications", MyApplicationViewSet, basename="mortgage-application")
router.register("manager/bookings", ManagerBookingViewSet, basename="manager-booking")
router.register("manager/mortgage", ManagerApplicationViewSet, basename="manager-mortgage")
router.register("manager/leads", ManagerLeadViewSet, basename="manager-lead")
router.register("admin/users", AdminUserViewSet, basename="admin-user")

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/company/", CompanyView.as_view()),
    path("api/leads/", LeadCreateView.as_view()),
    path("api/compare/", CompareView.as_view()),
    path("api/loyalty/me/", LoyaltyStatusView.as_view()),
    path("api/mortgage/calculate/", CalculatorView.as_view()),
    path("api/manager/stats/", ManagerStatsView.as_view()),
    path("api/", include(router.urls)),
    # Загруженные файлы (планировки, обложки). В продакшене лучше отдавать через nginx/S3.
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
]
