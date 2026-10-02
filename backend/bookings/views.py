from django.db import IntegrityError, transaction
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.emails import notify
from accounts.permissions import IsManager
from catalog.models import Apartment

from .models import Booking
from .serializers import BookingSerializer, ManagerActionSerializer


class MyBookingViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Брони текущего клиента."""

    serializer_class = BookingSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        Booking.expire_overdue()
        return Booking.objects.filter(user=self.request.user).select_related("apartment__building__complex", "manager", "user").prefetch_related("apartment__photos")

    def perform_create(self, serializer):
        user = self.request.user
        with transaction.atomic():
            apartment = Apartment.objects.select_for_update().get(pk=serializer.validated_data["apartment"].pk)
            if apartment.status != Apartment.Status.AVAILABLE:
                raise ValidationError({"apartment": ["Квартира только что была забронирована другим клиентом."]})
            final, pct = apartment.price_for(user)
            try:
                booking = serializer.save(user=user, base_price=apartment.price, discount_percent=pct, final_price=final)
            except IntegrityError:
                raise ValidationError({"apartment": ["На эту квартиру уже есть активная заявка."]})
            apartment.status = Apartment.Status.RESERVED
            apartment.save(update_fields=["status"])
        notify(user, "Заявка на бронирование принята",
               f"Ваша заявка №{booking.pk} на квартиру №{apartment.number} принята. Менеджер свяжется с вами в ближайшее время.")

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        booking = self.get_object()
        if booking.status not in Booking.ACTIVE_STATUSES:
            return Response({"detail": "Эту бронь нельзя отменить."}, status=400)
        booking.release(Booking.Status.CANCELLED)
        return Response(BookingSerializer(booking, context={"request": request}).data)


class ManagerBookingViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Все брони — для менеджеров и администраторов."""

    serializer_class = BookingSerializer
    permission_classes = [IsManager]
    filterset_fields = ("status",)
    search_fields = ("user__email", "user__last_name", "apartment__number", "apartment__building__complex__name")
    ordering_fields = ("created_at", "final_price")

    def get_queryset(self):
        Booking.expire_overdue()
        return Booking.objects.select_related("apartment__building__complex", "manager", "user").prefetch_related("apartment__photos")

    def _act(self, request, allowed, fn, subject):
        booking = self.get_object()
        if booking.status not in allowed:
            return Response({"detail": f"Действие недоступно для статуса «{booking.get_status_display()}»."}, status=400)
        s = ManagerActionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        fn(booking, s.validated_data.get("comment", ""))
        notify(booking.user, subject,
               f"Статус вашей брони №{booking.pk}: {booking.get_status_display()}.\n{booking.manager_comment}")
        return Response(BookingSerializer(booking, context={"request": request}).data)

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        return self._act(request, [Booking.Status.PENDING],
                         lambda b, c: b.confirm(request.user, c), "Бронь подтверждена")

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return self._act(request, Booking.ACTIVE_STATUSES,
                         lambda b, c: b.release(Booking.Status.REJECTED, request.user, c), "Бронь отклонена")

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        return self._act(request, [Booking.Status.CONFIRMED],
                         lambda b, c: b.complete(request.user, c), "Сделка завершена — поздравляем с покупкой!")
