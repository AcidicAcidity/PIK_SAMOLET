"""Демо-фотографии (Unsplash, лицензия Unsplash License — бесплатное использование).

Фото подгружаются по ссылке в браузере пользователя. Любое фото можно заменить
в Django admin: загрузить свой файл или указать другую ссылку.
"""
from catalog.models import Apartment, ApartmentPhoto, ComplexPhoto, ResidentialComplex


def u(photo_id, w=1600):
    return f"https://images.unsplash.com/photo-{photo_id}?auto=format&fit=crop&w={w}&q=80"


COMPLEX_PHOTOS = {
    "severnyi-park": [
        ("1520608421741-68228b76b6df", "Жилые дома у парка"),
        ("1631181165797-81fb37e6108c", "Корпуса среди зелени"),
        ("1580216643062-cf460548a66a", "Фасады комплекса"),
    ],
    "rechnoi-kvartal": [
        ("1759472018220-d6e258796fce", "Корпуса на закате"),
        ("1783801419756-7d549c3eb277", "Современные корпуса"),
        ("1525953776754-6c4b7ee655ab", "Фасады комплекса"),
    ],
    "gorizont-siti": [
        ("1624204386084-dd8c05e32226", "Стеклянные балконы с видом на закат"),
        ("1545324418-cc1a3fa10c00", "Архитектура башен"),
        ("1565363887715-8884629e09ee", "Видовые квартиры"),
    ],
    "lazurnye-vysoty": [
        ("1757924330358-a48d65664dac", "Бассейн на крыше"),
        ("1564471925181-982d3a6c1a3f", "Клубный дом"),
        ("1616594039964-ae9021a400a0", "Резиденция с видом на город"),
    ],
}

# Интерьеры по типу отделки
INTERIORS = {
    Apartment.Finishing.NONE: [
        ("1722650272764-08d92d193a9c", "Пример помещения до ремонта"),
        ("1721395286594-8913b06056eb", "Свободная планировка"),
        ("1757742690834-aa581b9f53b2", "Панорамные окна"),
    ],
    Apartment.Finishing.WHITEBOX: [
        ("1722650362309-2f2fdffbfbf1", "Отделка white box"),
        ("1722603929415-39052186178c", "Подготовлено под чистовую отделку"),
        ("1722650362357-7cb7d35a45eb", "Комната с окном"),
    ],
    Apartment.Finishing.FINE: [
        ("1665249934445-1de680641f50", "Гостиная с чистовой отделкой"),
        ("1588854337221-4cf9fa96059c", "Кухня"),
        ("1653974123568-b5eff6d851e1", "Спальня"),
        ("1584622650111-993a426fbf0a", "Санузел"),
        ("1678762200388-51e11225d4de", "Гостиная"),
        ("1675279200694-8529c73b1fd0", "Кухня-столовая"),
    ],
    Apartment.Finishing.FURNISHED: [
        ("1522708323590-d24dbb6b0267", "Гостиная с мебелью"),
        ("1556911220-bff31c812dba", "Кухня с островом"),
        ("1616594039964-ae9021a400a0", "Спальня"),
        ("1638799869566-b17fa794c4de", "Ванная комната"),
        ("1560448204-e02f11c3d0e2", "Зона отдыха"),
        ("1741764014072-68953e93cd48", "Кухня-гостиная"),
    ],
}


def ensure_photos(stdout=None):
    """Добавляет демо-фото комплексам и квартирам, у которых фото ещё нет (идемпотентно)."""
    added = 0
    demo_urls = {u(pid) for items in COMPLEX_PHOTOS.values() for pid, _ in items}
    for c in ResidentialComplex.objects.all():
        items = COMPLEX_PHOTOS.get(c.slug, COMPLEX_PHOTOS["severnyi-park"])
        current = list(c.photos.all())
        if current:
            # Обновляем только демо-фото; загруженные/изменённые в админке не трогаем
            wanted = [u(pid) for pid, _ in items]
            is_demo = all(not p.image and p.url in demo_urls for p in current)
            if not is_demo or [p.url for p in current] == wanted:
                continue
            c.photos.all().delete()
        ComplexPhoto.objects.bulk_create(
            ComplexPhoto(complex=c, url=u(pid), caption=cap, order=i) for i, (pid, cap) in enumerate(items)
        )
        added += len(items)

    batch = []
    for a in Apartment.objects.filter(photos__isnull=True).only("id", "finishing"):
        pool = INTERIORS.get(a.finishing) or INTERIORS[Apartment.Finishing.FINE]
        # разный порядок фото у разных квартир, чтобы каталог не выглядел одинаково
        shift = a.id % len(pool)
        ordered = pool[shift:] + pool[:shift]
        for i, (pid, cap) in enumerate(ordered[:4]):
            batch.append(ApartmentPhoto(apartment_id=a.id, url=u(pid, 1400), caption=cap, order=i))
    ApartmentPhoto.objects.bulk_create(batch, batch_size=500)
    added += len(batch)
    if stdout and added:
        stdout.write(f"Добавлено демо-фото: {added}")
    return added
