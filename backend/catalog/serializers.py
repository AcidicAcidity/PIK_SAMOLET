from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Count, Max, Min, Q
from rest_framework import serializers

from .models import Apartment, Building, Favorite, ResidentialComplex


def _lines(text):
    return [x.strip() for x in (text or "").splitlines() if x.strip()]


class BuildingShortSerializer(serializers.ModelSerializer):
    stage_display = serializers.CharField(source="get_stage_display", read_only=True)

    class Meta:
        model = Building
        fields = ("id", "number", "floors", "stage", "stage_display", "completion_quarter", "construction_progress")


class ComplexListSerializer(serializers.ModelSerializer):
    housing_class_display = serializers.CharField(source="get_housing_class_display", read_only=True)
    features_list = serializers.SerializerMethodField()
    stats = serializers.SerializerMethodField()

    class Meta:
        model = ResidentialComplex
        fields = (
            "id", "name", "slug", "tagline", "address", "district", "metro", "metro_minutes",
            "housing_class", "housing_class_display", "completion_year", "accent_color", "image",
            "features_list", "stats",
        )

    def get_features_list(self, obj):
        return _lines(obj.features)

    def get_stats(self, obj):
        qs = Apartment.objects.filter(building__complex=obj)
        agg = qs.aggregate(
            total=Count("id"),
            available=Count("id", filter=Q(status=Apartment.Status.AVAILABLE)),
            min_price=Min("price", filter=Q(status=Apartment.Status.AVAILABLE)),
            max_price=Max("price", filter=Q(status=Apartment.Status.AVAILABLE)),
            min_area=Min("area"),
            max_area=Max("area"),
        )
        return agg


class ComplexDetailSerializer(ComplexListSerializer):
    buildings = BuildingShortSerializer(many=True, read_only=True)

    class Meta(ComplexListSerializer.Meta):
        fields = ComplexListSerializer.Meta.fields + ("description", "latitude", "longitude", "buildings")


class ApartmentListSerializer(serializers.ModelSerializer):
    complex_id = serializers.IntegerField(source="building.complex_id", read_only=True)
    complex_name = serializers.CharField(source="building.complex.name", read_only=True)
    complex_slug = serializers.CharField(source="building.complex.slug", read_only=True)
    accent_color = serializers.CharField(source="building.complex.accent_color", read_only=True)
    building_number = serializers.CharField(source="building.number", read_only=True)
    floors_total = serializers.IntegerField(source="building.floors", read_only=True)
    completion_quarter = serializers.CharField(source="building.completion_quarter", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    finishing_display = serializers.CharField(source="get_finishing_display", read_only=True)
    rooms_label = serializers.CharField(read_only=True)
    price_per_m2 = serializers.DecimalField(max_digits=12, decimal_places=0, read_only=True)
    discount_percent = serializers.SerializerMethodField()
    discounted_price = serializers.SerializerMethodField()
    is_favorite = serializers.SerializerMethodField()

    class Meta:
        model = Apartment
        fields = (
            "id", "number", "floor", "floors_total", "rooms", "rooms_label", "area", "kitchen_area",
            "price", "old_price", "price_per_m2", "discount_percent", "discounted_price",
            "status", "status_display", "finishing", "finishing_display",
            "complex_id", "complex_name", "complex_slug", "accent_color", "building", "building_number",
            "completion_quarter", "plan_image", "is_favorite",
        )

    def _pct(self):
        return Decimal(self.context.get("discount_percent", 0) or 0)

    def get_discount_percent(self, obj):
        return self._pct()

    def get_discounted_price(self, obj):
        pct = self._pct()
        return (obj.price * (100 - pct) / 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP)

    def get_is_favorite(self, obj):
        return obj.id in self.context.get("favorite_ids", set())


class ApartmentDetailSerializer(ApartmentListSerializer):
    complex = serializers.SerializerMethodField()
    building_info = BuildingShortSerializer(source="building", read_only=True)
    similar = serializers.SerializerMethodField()
    has_active_booking = serializers.SerializerMethodField()

    class Meta(ApartmentListSerializer.Meta):
        fields = ApartmentListSerializer.Meta.fields + (
            "living_area", "ceiling_height", "bathrooms", "balcony", "window_view", "description",
            "complex", "building_info", "similar", "has_active_booking",
        )

    def get_complex(self, obj):
        c = obj.building.complex
        return {
            "id": c.id, "name": c.name, "slug": c.slug, "address": c.address, "district": c.district,
            "metro": c.metro, "metro_minutes": c.metro_minutes,
            "housing_class_display": c.get_housing_class_display(), "features_list": _lines(c.features),
            "accent_color": c.accent_color,
        }

    def get_similar(self, obj):
        qs = (
            Apartment.objects.select_related("building__complex")
            .filter(rooms=obj.rooms, status=Apartment.Status.AVAILABLE)
            .exclude(pk=obj.pk)
            .order_by("?")[:4]
        )
        return ApartmentListSerializer(qs, many=True, context=self.context).data

    def get_has_active_booking(self, obj):
        from bookings.models import Booking

        return obj.bookings.filter(status__in=Booking.ACTIVE_STATUSES).exists()


class CompareSerializer(ApartmentDetailSerializer):
    class Meta(ApartmentDetailSerializer.Meta):
        fields = tuple(f for f in ApartmentDetailSerializer.Meta.fields if f != "similar")


class ApartmentWriteSerializer(serializers.ModelSerializer):
    """Для менеджера: создание/редактирование квартиры."""

    class Meta:
        model = Apartment
        fields = (
            "id", "building", "number", "floor", "rooms", "area", "living_area", "kitchen_area",
            "ceiling_height", "bathrooms", "balcony", "window_view", "finishing", "price", "old_price",
            "status", "description",
        )

    def validate(self, attrs):
        building = attrs.get("building") or getattr(self.instance, "building", None)
        floor = attrs.get("floor", getattr(self.instance, "floor", None))
        if building and floor and floor > building.floors:
            raise serializers.ValidationError({"floor": f"В корпусе всего {building.floors} этажей."})
        return attrs


class FavoriteSerializer(serializers.ModelSerializer):
    apartment = ApartmentListSerializer(read_only=True)

    class Meta:
        model = Favorite
        fields = ("id", "apartment", "created_at")
