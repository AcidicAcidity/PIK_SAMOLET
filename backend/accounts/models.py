import hashlib
import secrets
import uuid
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models
from django.db.models import Sum
from django.utils import timezone


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra):
        if not email:
            raise ValueError("Email обязателен")
        email = self.normalize_email(email).lower()
        user = self.model(email=email, **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra):
        extra.setdefault("is_staff", False)
        extra.setdefault("is_superuser", False)
        extra.setdefault("role", User.Role.CLIENT)
        return self._create_user(email, password, **extra)

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault("is_staff", True)
        extra.setdefault("is_superuser", True)
        extra.setdefault("role", User.Role.ADMIN)
        extra.setdefault("email_verified", True)
        return self._create_user(email, password, **extra)


class User(AbstractUser):
    """Пользователь. Логин — email. Роль определяет доступ к разделам."""

    class Role(models.TextChoices):
        CLIENT = "client", "Клиент"
        MANAGER = "manager", "Менеджер"
        ADMIN = "admin", "Администратор"

    username = None
    email = models.EmailField("Email", unique=True)
    phone = models.CharField("Телефон", max_length=32, blank=True)
    middle_name = models.CharField("Отчество", max_length=150, blank=True)
    role = models.CharField("Роль", max_length=16, choices=Role.choices, default=Role.CLIENT)
    email_verified = models.BooleanField("Email подтверждён", default=False)
    loyalty_level_override = models.ForeignKey(
        "accounts.LoyaltyLevel",
        verbose_name="Уровень лояльности (вручную)",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="+",
        help_text="Если задан — используется вместо автоматически рассчитанного уровня.",
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects = UserManager()

    class Meta:
        verbose_name = "Пользователь"
        verbose_name_plural = "Пользователи"
        ordering = ("-date_joined",)

    def __str__(self):
        return self.email

    # --- роли ---
    @property
    def is_manager(self):
        return self.role in (self.Role.MANAGER, self.Role.ADMIN)

    @property
    def is_admin_role(self):
        return self.role == self.Role.ADMIN or self.is_superuser

    def save(self, *args, **kwargs):
        # Админ по роли получает доступ в Django admin
        if self.role == self.Role.ADMIN:
            self.is_staff = True
        super().save(*args, **kwargs)

    # --- программа лояльности ---
    @property
    def purchases_total(self) -> Decimal:
        from bookings.models import Booking

        total = self.bookings.filter(status=Booking.Status.COMPLETED).aggregate(s=Sum("final_price"))["s"]
        return total or Decimal("0")

    @property
    def loyalty_level(self):
        if self.loyalty_level_override_id:
            return self.loyalty_level_override
        return LoyaltyLevel.for_amount(self.purchases_total)

    @property
    def discount_percent(self) -> Decimal:
        level = self.loyalty_level
        return level.discount_percent if level else Decimal("0")


class LoyaltyLevel(models.Model):
    """Уровень программы лояльности. Уровень клиента определяется суммой завершённых сделок."""

    name = models.CharField("Название", max_length=64, unique=True)
    min_purchases_amount = models.DecimalField("Сумма покупок от, ₽", max_digits=14, decimal_places=2, default=0)
    discount_percent = models.DecimalField("Скидка, %", max_digits=5, decimal_places=2, default=0)
    color = models.CharField("Цвет карты", max_length=16, default="#8a94a6")
    perks = models.TextField("Привилегии (по одной на строку)", blank=True)

    class Meta:
        verbose_name = "Уровень лояльности"
        verbose_name_plural = "Уровни лояльности"
        ordering = ("min_purchases_amount",)

    def __str__(self):
        return f"{self.name} ({self.discount_percent}%)"

    @classmethod
    def for_amount(cls, amount):
        return cls.objects.filter(min_purchases_amount__lte=amount).order_by("-min_purchases_amount").first()

    def next_level(self):
        return LoyaltyLevel.objects.filter(min_purchases_amount__gt=self.min_purchases_amount).order_by("min_purchases_amount").first()


class EmailCode(models.Model):
    """Одноразовый код, отправленный на email (вход, регистрация)."""

    class Purpose(models.TextChoices):
        LOGIN = "login", "Вход"
        REGISTER = "register", "Подтверждение регистрации"
        RESET = "reset", "Восстановление пароля"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="email_codes")
    purpose = models.CharField(max_length=16, choices=Purpose.choices)
    code_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    used = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Код подтверждения"
        verbose_name_plural = "Коды подтверждения"
        ordering = ("-created_at",)

    @staticmethod
    def hash_code(code: str) -> str:
        return hashlib.sha256(f"{settings.SECRET_KEY}:{code}".encode()).hexdigest()

    @classmethod
    def issue(cls, user, purpose):
        """Создаёт новый код (старые неиспользованные коды того же назначения гасятся)."""
        cls.objects.filter(user=user, purpose=purpose, used=False).update(used=True)
        code = f"{secrets.randbelow(10**6):06d}"
        ttl = settings.TWO_FACTOR["CODE_TTL_MINUTES"]
        obj = cls.objects.create(
            user=user,
            purpose=purpose,
            code_hash=cls.hash_code(code),
            expires_at=timezone.now() + timezone.timedelta(minutes=ttl),
        )
        return obj, code

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at

    def check_code(self, code: str) -> bool:
        return secrets.compare_digest(self.code_hash, self.hash_code(code.strip()))
