from django.db.models import Count, Max, Min, Q
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsManagerOrReadOnly

from .filters import ApartmentFilter
from .models import Apartment, Building, Favorite, ResidentialComplex
from .serializers import (
    ApartmentDetailSerializer,
    ApartmentListSerializer,
    ApartmentWriteSerializer,
    BuildingShortSerializer,
    CompareSerializer,
    ComplexDetailSerializer,
    ComplexListSerializer,
    FavoriteSerializer,
)


class UserPricingContextMixin:
    """Добавляет в контекст скидку пользователя и id избранных квартир (1 запрос на весь список)."""

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        user = self.request.user
        if user.is_authenticated:
            ctx["discount_percent"] = user.discount_percent
            ctx["favorite_ids"] = set(user.favorites.values_list("apartment_id", flat=True))
        return ctx


class ComplexViewSet(viewsets.ModelViewSet):
    queryset = ResidentialComplex.objects.filter(is_published=True).prefetch_related("buildings")
    permission_classes = [IsManagerOrReadOnly]
    lookup_field = "slug"
    pagination_class = None
    search_fields = ("name", "district", "metro", "address")

    def get_serializer_class(self):
        return ComplexListSerializer if self.action == "list" else ComplexDetailSerializer


class BuildingViewSet(viewsets.ModelViewSet):
    queryset = Building.objects.all()
    serializer_class = BuildingShortSerializer
    permission_classes = [IsManagerOrReadOnly]
    filterset_fields = ("complex",)
    pagination_class = None

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            class _S(BuildingShortSerializer):
                class Meta(BuildingShortSerializer.Meta):
                    fields = BuildingShortSerializer.Meta.fields + ("complex",)
            return _S
        return BuildingShortSerializer


class ApartmentViewSet(UserPricingContextMixin, viewsets.ModelViewSet):
    queryset = Apartment.objects.select_related("building__complex").all()
    permission_classes = [IsManagerOrReadOnly]
    filterset_class = ApartmentFilter
    ordering_fields = ("price", "area", "floor", "rooms", "created_at")
    search_fields = ("number", "building__complex__name")

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return ApartmentWriteSerializer
        if self.action == "retrieve":
            return ApartmentDetailSerializer
        return ApartmentListSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # Клиенты по умолчанию не видят проданные, если не указан явный фильтр status
        if self.action == "list" and "status" not in self.request.query_params:
            qs = qs.exclude(status=Apartment.Status.SOLD)
        return qs

    @action(detail=False, methods=["get"], permission_classes=[])
    def facets(self, request):
        """Границы значений для фильтров каталога."""
        qs = Apartment.objects.exclude(status=Apartment.Status.SOLD)
        agg = qs.aggregate(
            price_min=Min("price"), price_max=Max("price"),
            area_min=Min("area"), area_max=Max("area"),
            floor_max=Max("floor"), total=Count("id"),
        )
        rooms = list(qs.values("rooms").annotate(count=Count("id")).order_by("rooms"))
        complexes = list(
            ResidentialComplex.objects.filter(is_published=True)
            .annotate(count=Count("buildings__apartments", filter=Q(buildings__apartments__status="available")))
            .values("id", "name", "slug", "count")
        )
        return Response({**agg, "rooms": rooms, "complexes": complexes,
                         "finishing": [{"value": v, "label": l} for v, l in Apartment.Finishing.choices]})

    @action(detail=True, methods=["post", "delete"], permission_classes=[IsAuthenticated])
    def favorite(self, request, pk=None):
        apartment = self.get_object()
        if request.method == "POST":
            Favorite.objects.get_or_create(user=request.user, apartment=apartment)
            return Response({"is_favorite": True}, status=status.HTTP_201_CREATED)
        Favorite.objects.filter(user=request.user, apartment=apartment).delete()
        return Response({"is_favorite": False})


class FavoriteViewSet(UserPricingContextMixin, mixins.ListModelMixin, mixins.DestroyModelMixin, viewsets.GenericViewSet):
    serializer_class = FavoriteSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return Favorite.objects.filter(user=self.request.user).select_related("apartment__building__complex")


class CompareView(APIView):
    """Сравнение квартир: /api/compare/?ids=1,2,3 (до 4 шт.)."""

    def get(self, request):
        try:
            ids = [int(x) for x in request.query_params.get("ids", "").split(",") if x.strip()][:4]
        except ValueError:
            return Response({"detail": "Некорректный список id."}, status=400)
        qs = Apartment.objects.select_related("building__complex").filter(id__in=ids)
        ctx = {"request": request}
        if request.user.is_authenticated:
            ctx["discount_percent"] = request.user.discount_percent
            ctx["favorite_ids"] = set(request.user.favorites.values_list("apartment_id", flat=True))
        return Response(CompareSerializer(qs, many=True, context=ctx).data)
