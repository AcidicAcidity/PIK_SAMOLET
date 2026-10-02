from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.db import models
from django.utils.text import slugify


class ResidentialComplex(models.Model):
    """Жилой комплекс (ЖК)."""

    class Klass(models.TextChoices):
        COMFORT = "comfort", "Комфорт"
        BUSINESS = "business", "Бизнес"
        PREMIUM = "premium", "Премиум"

    name = models.CharField("Название", max_length=128)
    slug = models.SlugField(unique=True, max_length=140, blank=True)
    tagline = models.CharField("Слоган", max_length=200, blank=True)
    description = models.TextField("Описание", blank=True)
    address = models.CharField("Адрес", max_length=255)
    district = models.CharField("Район", max_length=128, blank=True)
    metro = models.CharField("Метро", max_length=128, blank=True)
    metro_minutes = models.PositiveSmallIntegerField("Минут до метро пешком", null=True, blank=True)
    housing_class = models.CharField("Класс жилья", max_length=16, choices=Klass.choices, default=Klass.COMFORT)
    completion_year = models.PositiveSmallIntegerField("Год сдачи", null=True, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    features = models.TextField("Особенности (по одной на строку)", blank=True)
    accent_color = models.CharField("Акцентный цвет", max_length=16, default="#1f6feb")
    image = models.ImageField("Обложка (файл)", upload_to="complexes/", blank=True)
    image_url = models.URLField("Обложка (ссылка)", max_length=500, blank=True, help_text="Используется, если файл не загружен")
    is_published = models.BooleanField("Опубликован", default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Жилой комплекс"
        verbose_name_plural = "Жилые комплексы"
        ordering = ("completion_year", "name")

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name, allow_unicode=False) or "complex"
            slug, i = base, 2
            while ResidentialComplex.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug, i = f"{base}-{i}", i + 1
            self.slug = slug
        super().save(*args, **kwargs)


class Building(models.Model):
    """Корпус внутри ЖК."""

    class Stage(models.TextChoices):
        PROJECT = "project", "Проект"
        CONSTRUCTION = "construction", "Строится"
        DONE = "done", "Сдан"

    complex = models.ForeignKey(ResidentialComplex, on_delete=models.CASCADE, related_name="buildings", verbose_name="ЖК")
    number = models.CharField("Номер корпуса", max_length=16)
    floors = models.PositiveSmallIntegerField("Этажность")
    stage = models.CharField("Стадия", max_length=16, choices=Stage.choices, default=Stage.CONSTRUCTION)
    completion_quarter = models.CharField("Срок сдачи", max_length=16, blank=True, help_text="Например: IV кв. 2027")
    construction_progress = models.PositiveSmallIntegerField("Готовность, %", default=0)

    class Meta:
        verbose_name = "Корпус"
        verbose_name_plural = "Корпуса"
        ordering = ("complex", "number")
        unique_together = ("complex", "number")

    def __str__(self):
        return f"{self.complex.name}, корп. {self.number}"


class Apartment(models.Model):
    class Status(models.TextChoices):
        AVAILABLE = "available", "В продаже"
        RESERVED = "reserved", "Забронирована"
        SOLD = "sold", "Продана"

    class Finishing(models.TextChoices):
        NONE = "none", "Без отделки"
        WHITEBOX = "whitebox", "White box"
        FINE = "fine", "Чистовая"
        FURNISHED = "furnished", "С мебелью"

    building = models.ForeignKey(Building, on_delete=models.CASCADE, related_name="apartments", verbose_name="Корпус")
    number = models.CharField("Номер квартиры", max_length=16)
    floor = models.PositiveSmallIntegerField("Этаж")
    rooms = models.PositiveSmallIntegerField("Комнат", help_text="0 — студия")
    area = models.DecimalField("Общая площадь, м²", max_digits=7, decimal_places=2)
    living_area = models.DecimalField("Жилая площадь, м²", max_digits=7, decimal_places=2, null=True, blank=True)
    kitchen_area = models.DecimalField("Площадь кухни, м²", max_digits=6, decimal_places=2, null=True, blank=True)
    ceiling_height = models.DecimalField("Высота потолков, м", max_digits=4, decimal_places=2, default=Decimal("2.8"))
    bathrooms = models.PositiveSmallIntegerField("Санузлов", default=1)
    balcony = models.BooleanField("Балкон/лоджия", default=False)
    window_view = models.CharField("Вид из окон", max_length=128, blank=True)
    finishing = models.CharField("Отделка", max_length=16, choices=Finishing.choices, default=Finishing.NONE)
    price = models.DecimalField("Цена, ₽", max_digits=14, decimal_places=2)
    old_price = models.DecimalField("Старая цена, ₽", max_digits=14, decimal_places=2, null=True, blank=True)
    status = models.CharField("Статус", max_length=16, choices=Status.choices, default=Status.AVAILABLE, db_index=True)
    description = models.TextField("Описание", blank=True)
    plan_image = models.ImageField("Планировка", upload_to="plans/", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Квартира"
        verbose_name_plural = "Квартиры"
        ordering = ("price",)
        unique_together = ("building", "number")
        indexes = [models.Index(fields=["rooms", "price"]), models.Index(fields=["area"])]

    def __str__(self):
        return f"Кв. {self.number}, {self.building}"

    @property
    def price_per_m2(self):
        return (self.price / self.area).quantize(Decimal("1"), rounding=ROUND_HALF_UP) if self.area else None

    @property
    def rooms_label(self):
        return "Студия" if self.rooms == 0 else f"{self.rooms}-комнатная"

    def price_for(self, user):
        """Цена с учётом скидки по программе лояльности."""
        if user is None or not user.is_authenticated:
            return self.price, Decimal("0")
        pct = Decimal(user.discount_percent)
        final = (self.price * (Decimal("100") - pct) / Decimal("100")).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
        return final, pct


def photo_src(obj):
    """Относительный URL загруженного файла или внешняя ссылка."""
    if getattr(obj, "image", None):
        return obj.image.url
    return getattr(obj, "url", "") or getattr(obj, "image_url", "") or ""


class ComplexPhoto(models.Model):
    complex = models.ForeignKey(ResidentialComplex, on_delete=models.CASCADE, related_name="photos", verbose_name="ЖК")
    image = models.ImageField("Файл", upload_to="complexes/gallery/", blank=True)
    url = models.URLField("Ссылка", max_length=500, blank=True)
    caption = models.CharField("Подпись", max_length=200, blank=True)
    order = models.PositiveSmallIntegerField("Порядок", default=0)

    class Meta:
        verbose_name = "Фото ЖК"
        verbose_name_plural = "Фото ЖК"
        ordering = ("order", "id")

    @property
    def src(self):
        return photo_src(self)


class ApartmentPhoto(models.Model):
    apartment = models.ForeignKey(Apartment, on_delete=models.CASCADE, related_name="photos", verbose_name="Квартира")
    image = models.ImageField("Файл", upload_to="apartments/", blank=True)
    url = models.URLField("Ссылка", max_length=500, blank=True)
    caption = models.CharField("Подпись", max_length=200, blank=True)
    order = models.PositiveSmallIntegerField("Порядок", default=0)

    class Meta:
        verbose_name = "Фото квартиры"
        verbose_name_plural = "Фото квартир"
        ordering = ("order", "id")

    @property
    def src(self):
        return photo_src(self)


class Favorite(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="favorites")
    apartment = models.ForeignKey(Apartment, on_delete=models.CASCADE, related_name="favorited_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Избранное"
        verbose_name_plural = "Избранное"
        unique_together = ("user", "apartment")
        ordering = ("-created_at",)
