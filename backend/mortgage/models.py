from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.db import models


class MortgageProgram(models.Model):
    """Ипотечная программа банка-партнёра."""

    bank_name = models.CharField("Банк", max_length=128)
    name = models.CharField("Программа", max_length=128)
    rate = models.DecimalField("Ставка, % годовых", max_digits=5, decimal_places=2)
    min_down_payment_percent = models.DecimalField("Мин. первый взнос, %", max_digits=5, decimal_places=2, default=20)
    max_term_years = models.PositiveSmallIntegerField("Макс. срок, лет", default=30)
    max_amount = models.DecimalField("Макс. сумма кредита, ₽", max_digits=14, decimal_places=2, default=30_000_000)
    description = models.TextField("Условия", blank=True)
    badge = models.CharField("Метка", max_length=32, blank=True, help_text="Например: «Господдержка»")
    color = models.CharField("Цвет", max_length=16, default="#0f766e")
    is_active = models.BooleanField("Активна", default=True)

    class Meta:
        verbose_name = "Ипотечная программа"
        verbose_name_plural = "Ипотечные программы"
        ordering = ("rate",)

    def __str__(self):
        return f"{self.bank_name} — {self.name} ({self.rate}%)"


def annuity(loan: Decimal, annual_rate: Decimal, years: int):
    """Аннуитетный расчёт. Возвращает словарь с платежом и графиком по годам."""
    loan = Decimal(loan)
    n = int(years) * 12
    r = Decimal(annual_rate) / Decimal(1200)
    if loan <= 0 or n <= 0:
        return {"monthly_payment": Decimal(0), "total_payment": Decimal(0), "overpayment": Decimal(0), "schedule": []}
    if r == 0:
        monthly = loan / n
    else:
        k = (1 + r) ** n
        monthly = loan * r * k / (k - 1)
    balance = loan
    schedule = []
    for year in range(1, int(years) + 1):
        paid_interest = paid_principal = Decimal(0)
        for _ in range(12):
            interest = balance * r
            principal = min(monthly - interest, balance)
            balance -= principal
            paid_interest += interest
            paid_principal += principal
        schedule.append({
            "year": year,
            "principal": paid_principal.quantize(Decimal("1"), ROUND_HALF_UP),
            "interest": paid_interest.quantize(Decimal("1"), ROUND_HALF_UP),
            "balance": max(balance, Decimal(0)).quantize(Decimal("1"), ROUND_HALF_UP),
        })
    total = monthly * n
    q = lambda v: v.quantize(Decimal("1"), ROUND_HALF_UP)  # noqa: E731
    return {
        "monthly_payment": q(monthly),
        "total_payment": q(total),
        "overpayment": q(total - loan),
        # банки обычно требуют, чтобы платёж не превышал ~50% дохода
        "recommended_income": q(monthly * 2),
        "schedule": schedule,
    }


class MortgageApplication(models.Model):
    class Status(models.TextChoices):
        NEW = "new", "Новая"
        IN_REVIEW = "in_review", "На рассмотрении в банке"
        APPROVED = "approved", "Одобрена"
        REJECTED = "rejected", "Отказ"
        CANCELLED = "cancelled", "Отозвана клиентом"

    class Employment(models.TextChoices):
        HIRED = "hired", "Работа по найму"
        BUSINESS = "business", "Собственный бизнес"
        SELF = "self", "Самозанятый / ИП"
        OTHER = "other", "Другое"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="mortgage_applications")
    program = models.ForeignKey(MortgageProgram, on_delete=models.PROTECT, related_name="applications", verbose_name="Программа")
    apartment = models.ForeignKey("catalog.Apartment", on_delete=models.SET_NULL, null=True, blank=True, related_name="mortgage_applications")
    property_price = models.DecimalField("Стоимость недвижимости", max_digits=14, decimal_places=2)
    down_payment = models.DecimalField("Первоначальный взнос", max_digits=14, decimal_places=2)
    term_years = models.PositiveSmallIntegerField("Срок, лет")
    rate = models.DecimalField("Ставка", max_digits=5, decimal_places=2)
    loan_amount = models.DecimalField("Сумма кредита", max_digits=14, decimal_places=2)
    monthly_payment = models.DecimalField("Ежемесячный платёж", max_digits=14, decimal_places=2)
    monthly_income = models.DecimalField("Ежемесячный доход", max_digits=14, decimal_places=2)
    employment = models.CharField("Занятость", max_length=16, choices=Employment.choices, default=Employment.HIRED)
    full_name = models.CharField("ФИО", max_length=255)
    phone = models.CharField("Телефон", max_length=32)
    birth_date = models.DateField("Дата рождения", null=True, blank=True)
    comment = models.TextField("Комментарий", blank=True)
    status = models.CharField("Статус", max_length=16, choices=Status.choices, default=Status.NEW, db_index=True)
    manager = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    manager_comment = models.TextField("Комментарий менеджера", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Заявка на ипотеку"
        verbose_name_plural = "Заявки на ипотеку"
        ordering = ("-created_at",)

    def __str__(self):
        return f"Заявка #{self.pk} ({self.full_name})"
