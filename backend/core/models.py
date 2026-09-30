from django.db import models


class CompanyInfo(models.Model):
    """Информация о застройщике (одна запись)."""

    name = models.CharField("Название", max_length=128, default="Новый Горизонт")
    slogan = models.CharField("Слоган", max_length=255, blank=True)
    about = models.TextField("О компании", blank=True)
    mission = models.TextField("Миссия", blank=True)
    founded_year = models.PositiveSmallIntegerField("Год основания", default=2004)
    phone = models.CharField("Телефон", max_length=32, blank=True)
    email = models.EmailField("Email", blank=True)
    address = models.CharField("Офис продаж", max_length=255, blank=True)
    work_hours = models.CharField("Часы работы", max_length=128, blank=True)
    inn = models.CharField("ИНН", max_length=16, blank=True)
    built_sqm = models.PositiveIntegerField("Построено, тыс. м²", default=0)
    houses_built = models.PositiveIntegerField("Сдано домов", default=0)
    families = models.PositiveIntegerField("Семей получили ключи", default=0)
    advantages = models.JSONField("Преимущества", default=list, blank=True, help_text='[{"icon":"...","title":"...","text":"..."}]')
    milestones = models.JSONField("История", default=list, blank=True, help_text='[{"year":2004,"title":"...","text":"..."}]')
    purchase_steps = models.JSONField("Шаги покупки", default=list, blank=True)
    awards = models.JSONField("Награды", default=list, blank=True)
    reviews = models.JSONField("Отзывы", default=list, blank=True)
    faq = models.JSONField("Вопросы и ответы", default=list, blank=True)

    class Meta:
        verbose_name = "Информация о компании"
        verbose_name_plural = "Информация о компании"

    def __str__(self):
        return self.name

    @classmethod
    def load(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class News(models.Model):
    class Category(models.TextChoices):
        NEWS = "news", "Новости"
        PROMO = "promo", "Акции"
        PROGRESS = "progress", "Ход строительства"

    title = models.CharField("Заголовок", max_length=255)
    category = models.CharField("Категория", max_length=16, choices=Category.choices, default=Category.NEWS)
    excerpt = models.CharField("Анонс", max_length=400, blank=True)
    body = models.TextField("Текст", blank=True)
    published_at = models.DateField("Дата публикации")
    complex = models.ForeignKey("catalog.ResidentialComplex", on_delete=models.SET_NULL, null=True, blank=True, related_name="news")
    is_published = models.BooleanField("Опубликовано", default=True)

    class Meta:
        verbose_name = "Новость"
        verbose_name_plural = "Новости"
        ordering = ("-published_at",)

    def __str__(self):
        return self.title


class Lead(models.Model):
    """Заявка на обратный звонок / консультацию."""

    class Status(models.TextChoices):
        NEW = "new", "Новая"
        IN_PROGRESS = "in_progress", "В работе"
        DONE = "done", "Обработана"

    class Topic(models.TextChoices):
        CONSULT = "consult", "Консультация по покупке"
        MORTGAGE = "mortgage", "Ипотека"
        VISIT = "visit", "Запись на просмотр"
        OTHER = "other", "Другое"

    name = models.CharField("Имя", max_length=128)
    phone = models.CharField("Телефон", max_length=32)
    email = models.EmailField("Email", blank=True)
    topic = models.CharField("Тема", max_length=16, choices=Topic.choices, default=Topic.CONSULT)
    message = models.TextField("Сообщение", blank=True)
    apartment = models.ForeignKey("catalog.Apartment", on_delete=models.SET_NULL, null=True, blank=True, related_name="leads")
    status = models.CharField("Статус", max_length=16, choices=Status.choices, default=Status.NEW, db_index=True)
    manager_comment = models.TextField("Комментарий менеджера", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Заявка на звонок"
        verbose_name_plural = "Заявки на звонок"
        ordering = ("-created_at",)

    def __str__(self):
        return f"{self.name} — {self.phone}"
