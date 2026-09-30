from django.conf import settings
from django.db import models, transaction
from django.utils import timezone

from catalog.models import Apartment


class Booking(models.Model):
    """Бронирование квартиры клиентом. Проходит обработку менеджером."""

    class Status(models.TextChoices):
        PENDING = "pending", "На рассмотрении"
        CONFIRMED = "confirmed", "Подтверждена"
        COMPLETED = "completed", "Сделка завершена"
        REJECTED = "rejected", "Отклонена"
        CANCELLED = "cancelled", "Отменена клиентом"
        EXPIRED = "expired", "Истёк срок"

    ACTIVE_STATUSES = (Status.PENDING, Status.CONFIRMED)
    MAX_ACTIVE_PER_USER = 3

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="bookings", verbose_name="Клиент")
    apartment = models.ForeignKey(Apartment, on_delete=models.PROTECT, related_name="bookings", verbose_name="Квартира")
    status = models.CharField("Статус", max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True)
    base_price = models.DecimalField("Цена без скидки", max_digits=14, decimal_places=2)
    discount_percent = models.DecimalField("Скидка, %", max_digits=5, decimal_places=2, default=0)
    final_price = models.DecimalField("Итоговая цена", max_digits=14, decimal_places=2)
    payment_method = models.CharField(
        "Способ покупки", max_length=16, default="mortgage",
        choices=[("cash", "Собственные средства"), ("mortgage", "Ипотека"), ("installment", "Рассрочка")],
    )
    comment = models.TextField("Комментарий клиента", blank=True)
    manager = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="managed_bookings", verbose_name="Менеджер"
    )
    manager_comment = models.TextField("Комментарий менеджера", blank=True)
    expires_at = models.DateTimeField("Бронь действует до", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Бронирование"
        verbose_name_plural = "Бронирования"
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(
                fields=["apartment"],
                condition=models.Q(status__in=["pending", "confirmed"]),
                name="one_active_booking_per_apartment",
            )
        ]

    def __str__(self):
        return f"Бронь #{self.pk} — {self.apartment}"

    # --- переходы статусов ---
    def _set_apartment(self, status):
        Apartment.objects.filter(pk=self.apartment_id).update(status=status)

    @transaction.atomic
    def confirm(self, manager, comment=""):
        self.status = self.Status.CONFIRMED
        self.manager = manager
        self.manager_comment = comment or self.manager_comment
        self.expires_at = timezone.now() + timezone.timedelta(days=settings.BOOKING_HOLD_DAYS)
        self.save()
        self._set_apartment(Apartment.Status.RESERVED)

    @transaction.atomic
    def complete(self, manager, comment=""):
        self.status = self.Status.COMPLETED
        self.manager = manager
        self.manager_comment = comment or self.manager_comment
        self.save()
        self._set_apartment(Apartment.Status.SOLD)

    @transaction.atomic
    def release(self, status, manager=None, comment=""):
        """Отклонение/отмена/истечение — квартира возвращается в продажу."""
        self.status = status
        if manager:
            self.manager = manager
        if comment:
            self.manager_comment = comment
        self.save()
        self._set_apartment(Apartment.Status.AVAILABLE)

    @classmethod
    def expire_overdue(cls):
        for b in cls.objects.filter(status=cls.Status.CONFIRMED, expires_at__lt=timezone.now()):
            b.release(cls.Status.EXPIRED, comment="Срок брони истёк автоматически.")
