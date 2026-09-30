from rest_framework import serializers

from catalog.models import Apartment
from catalog.serializers import ApartmentListSerializer

from .models import Booking


class ClientShortSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    phone = serializers.CharField()


class BookingSerializer(serializers.ModelSerializer):
    apartment_info = ApartmentListSerializer(source="apartment", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    payment_method_display = serializers.CharField(source="get_payment_method_display", read_only=True)
    client = ClientShortSerializer(source="user", read_only=True)
    manager_name = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = (
            "id", "apartment", "apartment_info", "status", "status_display",
            "base_price", "discount_percent", "final_price", "payment_method", "payment_method_display",
            "comment", "manager_comment", "manager_name", "client", "expires_at", "created_at", "updated_at",
        )
        read_only_fields = (
            "status", "base_price", "discount_percent", "final_price", "manager_comment", "expires_at",
        )

    def get_manager_name(self, obj):
        if not obj.manager:
            return None
        return f"{obj.manager.first_name} {obj.manager.last_name}".strip() or obj.manager.email

    def validate_apartment(self, apartment):
        if apartment.status != Apartment.Status.AVAILABLE:
            raise serializers.ValidationError("Эта квартира уже забронирована или продана.")
        if apartment.bookings.filter(status__in=Booking.ACTIVE_STATUSES).exists():
            raise serializers.ValidationError("На эту квартиру уже есть активная заявка.")
        return apartment

    def validate(self, attrs):
        user = self.context["request"].user
        if user.bookings.filter(status__in=Booking.ACTIVE_STATUSES).count() >= Booking.MAX_ACTIVE_PER_USER:
            raise serializers.ValidationError(
                f"Одновременно можно иметь не более {Booking.MAX_ACTIVE_PER_USER} активных броней."
            )
        return attrs


class ManagerActionSerializer(serializers.Serializer):
    comment = serializers.CharField(required=False, allow_blank=True)
