from django.db.models import Count, Q, Sum
from rest_framework import generics, mixins, serializers, viewsets
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from accounts.models import User
from accounts.permissions import IsAdminRole, IsManager
from bookings.models import Booking
from catalog.models import Apartment, ResidentialComplex
from mortgage.models import MortgageApplication, MortgageProgram

from .models import CompanyInfo, Lead, News


class CompanyInfoSerializer(serializers.ModelSerializer):
    class Meta:
        model = CompanyInfo
        exclude = ("id",)


class NewsSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source="get_category_display", read_only=True)
    complex_name = serializers.CharField(source="complex.name", read_only=True, default=None)

    class Meta:
        model = News
        fields = ("id", "title", "category", "category_display", "excerpt", "body", "published_at", "complex", "complex_name")


class LeadSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    topic_display = serializers.CharField(source="get_topic_display", read_only=True)

    class Meta:
        model = Lead
        fields = ("id", "name", "phone", "email", "topic", "topic_display", "message", "apartment",
                  "status", "status_display", "manager_comment", "created_at")
        read_only_fields = ("status", "manager_comment")


class LeadManagerSerializer(LeadSerializer):
    class Meta(LeadSerializer.Meta):
        read_only_fields = ("name", "phone", "email", "topic", "message", "apartment")


class CompanyView(APIView):
    """Данные для информационной страницы застройщика + живая статистика из БД."""

    def get(self, request):
        info = CompanyInfo.load()
        data = CompanyInfoSerializer(info).data
        data["live_stats"] = {
            "complexes": ResidentialComplex.objects.filter(is_published=True).count(),
            "apartments_available": Apartment.objects.filter(status=Apartment.Status.AVAILABLE).count(),
            "mortgage_programs": MortgageProgram.objects.filter(is_active=True).count(),
            "min_rate": MortgageProgram.objects.filter(is_active=True).order_by("rate").values_list("rate", flat=True).first(),
        }
        return Response(data)

    def patch(self, request):
        if not IsAdminRole().has_permission(request, self):
            return Response({"detail": "Доступно только администраторам."}, status=403)
        s = CompanyInfoSerializer(CompanyInfo.load(), data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)


class NewsViewSet(viewsets.ModelViewSet):
    serializer_class = NewsSerializer
    filterset_fields = ("category", "complex")

    def get_queryset(self):
        qs = News.objects.select_related("complex")
        u = self.request.user
        if not (u.is_authenticated and u.is_manager):
            qs = qs.filter(is_published=True)
        return qs

    def get_permissions(self):
        if self.action in ("list", "retrieve"):
            return []
        return [IsManager()]


class LeadCreateView(generics.CreateAPIView):
    serializer_class = LeadSerializer
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth"


class ManagerLeadViewSet(mixins.ListModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    serializer_class = LeadManagerSerializer
    permission_classes = [IsManager]
    queryset = Lead.objects.all()
    filterset_fields = ("status", "topic")
    search_fields = ("name", "phone", "email")


class ManagerStatsView(APIView):
    """Сводка для панели менеджера."""

    permission_classes = [IsManager]

    def get(self, request):
        apt = Apartment.objects.aggregate(
            total=Count("id"),
            available=Count("id", filter=Q(status="available")),
            reserved=Count("id", filter=Q(status="reserved")),
            sold=Count("id", filter=Q(status="sold")),
        )
        bookings = Booking.objects.aggregate(
            pending=Count("id", filter=Q(status="pending")),
            confirmed=Count("id", filter=Q(status="confirmed")),
            completed=Count("id", filter=Q(status="completed")),
            revenue=Sum("final_price", filter=Q(status="completed")),
        )
        mortgage = MortgageApplication.objects.aggregate(
            new=Count("id", filter=Q(status="new")),
            in_review=Count("id", filter=Q(status="in_review")),
            approved=Count("id", filter=Q(status="approved")),
        )
        by_complex = list(
            ResidentialComplex.objects.annotate(
                total=Count("buildings__apartments"),
                sold=Count("buildings__apartments", filter=Q(buildings__apartments__status="sold")),
                reserved=Count("buildings__apartments", filter=Q(buildings__apartments__status="reserved")),
            ).values("id", "name", "total", "sold", "reserved", "accent_color")
        )
        return Response({
            "apartments": apt, "bookings": bookings, "mortgage": mortgage,
            "leads_new": Lead.objects.filter(status="new").count(),
            "clients": User.objects.filter(role=User.Role.CLIENT).count(),
            "by_complex": by_complex,
        })
