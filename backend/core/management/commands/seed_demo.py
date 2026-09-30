"""Наполнение базы демо-данными: python manage.py seed_demo [--reset]"""
import random
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction

from accounts.models import LoyaltyLevel, User
from bookings.models import Booking
from catalog.models import Apartment, Building, Favorite, ResidentialComplex
from core.models import CompanyInfo, Lead, News
from mortgage.models import MortgageApplication, MortgageProgram, annuity

DEMO_USERS = [
    ("admin@novyi-gorizont.local", "Admin12345!", User.Role.ADMIN, "Анна", "Администраторова"),
    ("manager@novyi-gorizont.local", "Manager12345!", User.Role.MANAGER, "Михаил", "Продажин"),
    ("client@novyi-gorizont.local", "Client12345!", User.Role.CLIENT, "Иван", "Покупателев"),
    ("gold@novyi-gorizont.local", "Client12345!", User.Role.CLIENT, "Елена", "Инвесторова"),
]

LEVELS = [
    ("Старт", 0, "1.00", "#64748b", "Скидка 1% на любую квартиру\nПерсональный менеджер"),
    ("Серебро", 5_000_000, "2.00", "#94a3b8", "Скидка 2%\nБесплатная юридическая проверка\nПриоритетная запись на просмотр"),
    ("Золото", 15_000_000, "3.50", "#d4a017", "Скидка 3,5%\nКладовая в подарок\nСниженная ставка у банков-партнёров"),
    ("Платина", 30_000_000, "5.00", "#6d28d9", "Скидка 5%\nМашино-место со скидкой 50%\nДизайн-проект в подарок\nЗакрытые предпродажи"),
]

COMPLEXES = [
    dict(name="Северный парк", slug="severnyi-park", tagline="Квартал у большого парка для жизни с семьёй",
         district="Северный", metro="Парковая", metro_minutes=7, housing_class="comfort", completion_year=2026,
         address="ул. Лесная, 12", accent_color="#15803d", price_m2=245_000, lat="55.878", lng="37.585",
         features="Парк 40 га в 5 минутах\nДетский сад и школа на территории\nДвор без машин\nВелодорожки\nСпортивный кластер",
         description="«Северный парк» — квартал комфорт-класса на границе с лесопарком. Закрытые дворы-сады без машин, "
                     "собственная школа на 1100 мест и два детских сада, коммерция на первых этажах и подземный паркинг.",
         buildings=[("1", 17, "done", "Сдан", 100), ("2", 21, "construction", "IV кв. 2026", 85), ("3", 25, "construction", "II кв. 2027", 40)],
         finishing=["fine", "whitebox", "fine"]),
    dict(name="Речной квартал", slug="rechnoi-kvartal", tagline="Первая линия у воды и собственная набережная",
         district="Приречный", metro="Речной вокзал", metro_minutes=10, housing_class="comfort", completion_year=2027,
         address="Набережная ул., 3", accent_color="#0369a1", price_m2=285_000, lat="55.855", lng="37.476",
         features="Собственная набережная 800 м\nВидовые квартиры\nЛобби с консьержем\nФитнес-клуб\nКоворкинг для жителей",
         description="Квартал на первой линии реки с благоустроенной набережной, прогулочными зонами и причалом. "
                     "Высокие потолки, панорамное остекление и лобби с консьерж-сервисом в каждом подъезде.",
         buildings=[("1", 19, "construction", "I кв. 2027", 65), ("2", 23, "construction", "III кв. 2027", 30)],
         finishing=["whitebox", "fine"]),
    dict(name="Горизонт Сити", slug="gorizont-siti", tagline="Бизнес-класс в пяти минутах от делового центра",
         district="Центральный", metro="Деловая", metro_minutes=5, housing_class="business", completion_year=2027,
         address="Пресненский пр-т, 8", accent_color="#6d28d9", price_m2=410_000, lat="55.749", lng="37.537",
         features="Потолки 3,1 м\nПодземный паркинг с зарядками для электромобилей\nSPA и бассейн 25 м\nТеррасы на крыше\nУмный дом",
         description="Башни бизнес-класса с видами на деловой центр. Двухсветные лобби, бассейн и SPA, "
                     "эксплуатируемая кровля с зонами отдыха и система «умный дом» в каждой квартире.",
         buildings=[("A", 32, "construction", "II кв. 2027", 55), ("B", 28, "project", "IV кв. 2027", 10)],
         finishing=["fine", "none"]),
    dict(name="Лазурные высоты", slug="lazurnye-vysoty", tagline="Клубный дом премиум-класса с видом на исторический центр",
         district="Хамовники", metro="Фрунзенская", metro_minutes=4, housing_class="premium", completion_year=2028,
         address="Лазурный пер., 1", accent_color="#b45309", price_m2=680_000, lat="55.727", lng="37.580",
         features="Всего 96 резиденций\nЧастный двор-сад\nКонсьерж 24/7 и служба охраны\nВинный погреб и сигарная комната\nПентхаусы с террасами",
         description="Клубный дом на 96 резиденций в тихом переулке исторического района. Фасады из натурального камня, "
                     "двор-сад по проекту ландшафтного бюро и сервис уровня пятизвёздочного отеля.",
         buildings=[("1", 12, "project", "II кв. 2028", 5)],
         finishing=["furnished"]),
]

ROOM_AREAS = {0: (22, 29), 1: (34, 44), 2: (52, 66), 3: (72, 92), 4: (98, 135)}
VIEWS = ["Во двор", "На парк", "На город", "На реку", "На две стороны", "На закат"]

COMPANY = dict(
    name="Новый Горизонт",
    slogan="Строим кварталы, в которых хочется жить",
    about=(
        "«Новый Горизонт» — девелопер полного цикла: от поиска участка и архитектурной концепции до строительства, "
        "продаж и управления готовыми домами. За двадцать лет мы построили более 3,2 млн м² жилья и сдали 140 домов, "
        "ни разу не сорвав сроки. Все проекты реализуются по 214-ФЗ с использованием эскроу-счетов — ваши деньги "
        "защищены государством до момента ввода дома в эксплуатацию."
    ),
    mission="Создавать среду, где комфортно жить, растить детей и работать — с продуманными дворами, школами и сервисами в шаговой доступности.",
    founded_year=2006,
    phone="+7 (800) 555-35-35",
    email="sales@novyi-gorizont.local",
    address="Москва, Пресненский пр-т, 8, офис продаж",
    work_hours="Ежедневно с 9:00 до 21:00",
    inn="7700000000",
    built_sqm=3200,
    houses_built=140,
    families=48000,
    advantages=[
        {"icon": "shield", "title": "Эскроу и 214-ФЗ", "text": "Деньги хранятся в банке до сдачи дома. Риск недостроя — нулевой."},
        {"icon": "clock", "title": "Сдаём в срок", "text": "140 домов сданы в срок или раньше. Ни одного переноса за 20 лет."},
        {"icon": "tree", "title": "Дворы без машин", "text": "Парковки уходят под землю, а во дворах — сады, площадки и тишина."},
        {"icon": "school", "title": "Социальная инфраструктура", "text": "Школы, сады и поликлиники строим вместе с жилыми домами."},
        {"icon": "key", "title": "Отделка под ключ", "text": "Квартиры с чистовой отделкой — можно заезжать сразу после получения ключей."},
        {"icon": "percent", "title": "Выгодная ипотека", "text": "Субсидированные ставки от застройщика и 6 банков-партнёров."},
    ],
    milestones=[
        {"year": 2006, "title": "Основание компании", "text": "Первый проект — 17-этажный дом на 240 квартир."},
        {"year": 2011, "title": "Первый квартал", "text": "Запуск комплексного освоения территории на 250 000 м²."},
        {"year": 2016, "title": "1 млн м²", "text": "Общий объём введённого жилья превысил миллион квадратных метров."},
        {"year": 2020, "title": "Цифровые продажи", "text": "Запустили онлайн-бронирование и электронную регистрацию сделок."},
        {"year": 2023, "title": "Бизнес-класс", "text": "Вышли в сегмент бизнес-класса с проектом «Горизонт Сити»."},
        {"year": 2026, "title": "Премиум", "text": "Старт продаж клубного дома «Лазурные высоты»."},
    ],
    purchase_steps=[
        {"title": "Выберите квартиру", "text": "Подберите планировку в каталоге по цене, площади и этажу."},
        {"title": "Забронируйте онлайн", "text": "Бронь фиксирует цену на 14 дней — без визита в офис."},
        {"title": "Оформите ипотеку", "text": "Подайте заявку в личном кабинете — ответ банка за 1 день."},
        {"title": "Подпишите договор", "text": "Электронная регистрация ДДУ в Росреестре за 3–5 дней."},
        {"title": "Получите ключи", "text": "Приёмка квартиры с нашим инженером и переезд."},
    ],
    awards=[
        {"year": 2025, "title": "Девелопер года", "org": "Премия «Городская среда» (демо)"},
        {"year": 2024, "title": "Лучший проект комфорт-класса", "org": "Отраслевой конкурс (демо)"},
        {"year": 2023, "title": "Надёжный застройщик", "org": "Рейтинг сдачи в срок (демо)"},
    ],
    reviews=[
        {"name": "Ольга, ЖК «Северный парк»", "text": "Въехали точно в срок, отделка аккуратная. Двор без машин — лучшее, что могло быть с двумя детьми.", "rating": 5},
        {"name": "Дмитрий, ЖК «Речной квартал»", "text": "Бронировал онлайн, ипотеку одобрили через личный кабинет за день. Всё прозрачно.", "rating": 5},
        {"name": "Марина, ЖК «Северный парк»", "text": "Понравилось сопровождение менеджера — на все вопросы ответили быстро.", "rating": 4},
    ],
    faq=[
        {"q": "Как работает бронирование?", "a": "Вы оставляете заявку в каталоге, менеджер подтверждает её, и цена фиксируется на 14 дней."},
        {"q": "Как получить скидку?", "a": "Каждый зарегистрированный клиент участвует в программе лояльности. Чем больше сумма покупок — тем выше уровень и скидка (до 5%)."},
        {"q": "Можно ли купить квартиру без первого взноса?", "a": "Большинство программ требуют взнос от 15–20%. Уточните условия в разделе «Ипотека»."},
        {"q": "Безопасна ли покупка на этапе строительства?", "a": "Да, все сделки проходят по 214-ФЗ с эскроу-счетами: деньги получаем только после сдачи дома."},
    ],
)

PROGRAMS = [
    dict(bank_name="Банк «Меридиан»", name="Семейная ипотека", rate="6.00", min_down_payment_percent="20", max_term_years=30,
         max_amount=12_000_000, badge="Господдержка", color="#15803d",
         description="Для семей с ребёнком до 6 лет. Льготная ставка на весь срок кредита."),
    dict(bank_name="Банк «Вектор»", name="IT-ипотека", rate="6.00", min_down_payment_percent="20", max_term_years=30,
         max_amount=9_000_000, badge="Для IT", color="#2563eb",
         description="Для специалистов аккредитованных IT-компаний."),
    dict(bank_name="Банк «Орион»", name="Субсидия от застройщика", rate="9.90", min_down_payment_percent="15", max_term_years=30,
         max_amount=30_000_000, badge="Спецпредложение", color="#b45309",
         description="Ставка снижена за счёт застройщика на весь срок кредита."),
    dict(bank_name="Банк «Меридиан»", name="Стандартная", rate="18.50", min_down_payment_percent="15", max_term_years=30,
         max_amount=60_000_000, badge="", color="#475569",
         description="Для любых покупателей без ограничений по категории."),
    dict(bank_name="Банк «Орион»", name="Рыночная Премиум", rate="17.90", min_down_payment_percent="30", max_term_years=25,
         max_amount=150_000_000, badge="Премиум", color="#6d28d9",
         description="Для крупных сумм кредита, индивидуальное сопровождение."),
]

NEWS = [
    ("Открыты продажи корпуса 3 в «Северном парке»", "news", "Старт продаж нового корпуса: 380 квартир от студий до четырёхкомнатных, в том числе с террасами.", 0),
    ("Скидка до 7% при 100% оплате", "promo", "До конца месяца — дополнительная скидка при единовременной оплате. Суммируется с программой лояльности.", 3),
    ("Ход строительства: сентябрь", "progress", "В «Речном квартале» завершён монолит корпуса 1, начаты фасадные работы.", 6),
    ("Ставка 9,9% на весь срок", "promo", "Совместно с банком «Орион» запускаем субсидированную ипотеку для всех проектов компании.", 12),
    ("«Горизонт Сити» — получено разрешение на строительство башни B", "news", "Начались подготовительные работы на площадке второй башни.", 20),
    ("Ход строительства: август", "progress", "В «Северном парке» открыта школа на 1100 мест и благоустроен парк у корпуса 2.", 35),
]


class Command(BaseCommand):
    help = "Заполнить БД демо-данными"

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Удалить существующие данные каталога перед заполнением")

    @transaction.atomic
    def handle(self, *args, **opts):
        rnd = random.Random(42)
        if opts["reset"]:
            Booking.objects.all().delete()
            MortgageApplication.objects.all().delete()
            Favorite.objects.all().delete()
            Lead.objects.all().delete()
            News.objects.all().delete()
            Apartment.objects.all().delete()
            ResidentialComplex.objects.all().delete()
            MortgageProgram.objects.all().delete()
        elif ResidentialComplex.objects.exists():
            self.stdout.write(self.style.WARNING("Данные уже есть — пропускаю. Используйте --reset для пересоздания."))
            return

        # Уровни лояльности
        for name, amount, pct, color, perks in LEVELS:
            LoyaltyLevel.objects.update_or_create(
                name=name, defaults=dict(min_purchases_amount=amount, discount_percent=Decimal(pct), color=color, perks=perks)
            )

        # Пользователи
        users = {}
        for email, pwd, role, first, last in DEMO_USERS:
            u, created = User.objects.get_or_create(email=email, defaults=dict(role=role, first_name=first, last_name=last))
            u.role, u.first_name, u.last_name, u.email_verified = role, first, last, True
            u.phone = "+7 900 000-00-0" + str(len(users))
            if role == User.Role.ADMIN:
                u.is_superuser = True
            u.set_password(pwd)
            u.save()
            users[email] = u

        # Компания
        CompanyInfo.objects.update_or_create(pk=1, defaults=COMPANY)

        # ЖК, корпуса, квартиры
        for c in COMPLEXES:
            price_m2 = c["price_m2"]
            cx = ResidentialComplex.objects.create(
                name=c["name"], slug=c["slug"], tagline=c["tagline"], description=c["description"], address=c["address"],
                district=c["district"], metro=c["metro"], metro_minutes=c["metro_minutes"], housing_class=c["housing_class"],
                completion_year=c["completion_year"], latitude=c["lat"], longitude=c["lng"], features=c["features"],
                accent_color=c["accent_color"],
            )
            for (num, floors, stage, quarter, progress), finishing in zip(c["buildings"], c["finishing"]):
                b = Building.objects.create(complex=cx, number=num, floors=floors, stage=stage,
                                            completion_quarter=quarter, construction_progress=progress)
                per_floor = 6 if c["housing_class"] != "premium" else 8
                apt_no = 0
                for floor in range(2, floors + 1):
                    for pos in range(per_floor):
                        apt_no += 1
                        if rnd.random() > 0.22:  # в продаже только часть квартир
                            continue
                        if c["housing_class"] == "premium":
                            rooms = rnd.choice([2, 3, 3, 4, 4])
                        elif c["housing_class"] == "business":
                            rooms = rnd.choice([1, 1, 2, 2, 3, 4])
                        else:
                            rooms = rnd.choice([0, 0, 1, 1, 1, 2, 2, 3, 4])
                        lo, hi = ROOM_AREAS[rooms]
                        if c["housing_class"] == "premium":
                            lo, hi = int(lo * 1.4), int(hi * 1.5)
                        area = Decimal(str(round(rnd.uniform(lo, hi), 1)))
                        kitchen = Decimal(str(round(rnd.uniform(9, 18) if rooms else 0, 1))) or None
                        living = (area * Decimal("0.55")).quantize(Decimal("0.1"))
                        floor_k = Decimal(1) + Decimal(floor) / Decimal(floors) * Decimal("0.12")
                        fin_k = {"none": Decimal("0.95"), "whitebox": Decimal("1.0"), "fine": Decimal("1.07"), "furnished": Decimal("1.15")}[finishing]
                        price = (area * price_m2 * floor_k * fin_k / 10000).quantize(Decimal("1")) * 10000
                        r = rnd.random()
                        status = "available" if r < 0.84 else ("reserved" if r < 0.93 else "sold")
                        old_price = (price * Decimal("1.06")).quantize(Decimal("1000")) if rnd.random() < 0.15 else None
                        Apartment.objects.create(
                            building=b, number=str(apt_no), floor=floor, rooms=rooms, area=area, living_area=living,
                            kitchen_area=kitchen, ceiling_height=Decimal("3.10") if c["housing_class"] in ("business", "premium") else Decimal("2.85"),
                            bathrooms=2 if rooms >= 3 else 1, balcony=rnd.random() < 0.6, window_view=rnd.choice(VIEWS),
                            finishing=finishing, price=price, old_price=old_price, status=status,
                            description=(
                                f"{'Студия' if rooms == 0 else f'{rooms}-комнатная квартира'} площадью {area} м² на {floor} этаже. "
                                "Продуманная планировка без потерь площади, большие окна и "
                                f"{'кухня-гостиная' if rooms else 'зона кухни у окна'}. "
                                + ("Лоджия с панорамным остеклением. " if rnd.random() < 0.5 else "")
                            ),
                        )

        # Ипотечные программы
        progs = [MortgageProgram.objects.create(**p) for p in PROGRAMS]

        # Новости
        today = date.today()
        cxs = list(ResidentialComplex.objects.all())
        for i, (title, cat, excerpt, days) in enumerate(NEWS):
            News.objects.create(title=title, category=cat, excerpt=excerpt, body=excerpt + "\n\nПодробности уточняйте в офисе продаж.",
                                published_at=today - timedelta(days=days), complex=cxs[i % len(cxs)])

        # Демо-активность клиентов
        client, gold, manager = users["client@novyi-gorizont.local"], users["gold@novyi-gorizont.local"], users["manager@novyi-gorizont.local"]
        avail = list(Apartment.objects.filter(status="available").order_by("?")[:8])
        # «Золотой» клиент — две завершённые сделки
        for apt in avail[:2]:
            b = Booking.objects.create(user=gold, apartment=apt, base_price=apt.price, discount_percent=Decimal("1"),
                                       final_price=apt.price * Decimal("0.99"), payment_method="cash")
            b.confirm(manager)
            b.complete(manager, "Сделка зарегистрирована.")
        # Обычный клиент — одна бронь на рассмотрении
        apt = avail[2]
        final, pct = apt.price_for(client)
        Booking.objects.create(user=client, apartment=apt, base_price=apt.price, discount_percent=pct, final_price=final,
                               comment="Хотим посмотреть квартиру в выходные.")
        apt.status = "reserved"
        apt.save()
        for a in avail[3:6]:
            Favorite.objects.create(user=client, apartment=a)
        # Заявка на ипотеку
        a = avail[3]
        down = (a.price * Decimal("0.2")).quantize(Decimal("1"))
        calc = annuity(a.price - down, progs[2].rate, 25)
        MortgageApplication.objects.create(
            user=client, program=progs[2], apartment=a, property_price=a.price, down_payment=down, term_years=25,
            rate=progs[2].rate, loan_amount=a.price - down, monthly_payment=calc["monthly_payment"],
            monthly_income=Decimal("250000"), full_name="Покупателев Иван Петрович", phone="+7 900 000-00-02",
        )
        Lead.objects.create(name="Сергей", phone="+7 911 123-45-67", topic="visit", message="Хочу посмотреть шоурум в субботу.")
        Lead.objects.create(name="Наталья", phone="+7 912 765-43-21", topic="mortgage", message="Интересует семейная ипотека.")

        self.stdout.write(self.style.SUCCESS(
            f"Готово: ЖК {ResidentialComplex.objects.count()}, квартир {Apartment.objects.count()}, "
            f"программ {MortgageProgram.objects.count()}."
        ))
        for email, pwd, role, *_ in DEMO_USERS:
            self.stdout.write(f"  {role:8} {email} / {pwd}")
