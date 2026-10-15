"""Демо-фотографии (Unsplash, лицензия Unsplash License — бесплатное использование).

Файлы фото лежат в проекте: backend/core/seed_photos/<id>.jpg. При заполнении базы они
копируются в MEDIA_ROOT/demo/ и отдаются самим сайтом — интернет для них не нужен.
Ссылка на оригинал на Unsplash хранится только для справки (поле «Ссылка»).
Любое фото можно заменить в Django admin: загрузить свой файл.
"""
import os
import shutil
from pathlib import Path

from django.conf import settings
from django.db.models import Q

from catalog.models import Apartment, ApartmentPhoto, ComplexPhoto, ResidentialComplex

SEED_DIR = Path(__file__).resolve().parent / "seed_photos"


def local_photo(photo_id):
    """Копирует фото из проекта в media/demo/ и возвращает имя файла для ImageField ('' если файла нет)."""
    src = SEED_DIR / f"{photo_id}.jpg"
    if not src.is_file():
        return ""
    name = f"demo/{photo_id}.jpg"
    dst = Path(settings.MEDIA_ROOT) / name
    if not dst.is_file() or dst.stat().st_size != src.stat().st_size:
        os.makedirs(dst.parent, exist_ok=True)
        shutil.copyfile(src, dst)
    return name


def _pid(url):
    return url.split("photo-", 1)[1].split("?", 1)[0] if "photo-" in url else ""


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
    """Добавляет демо-фото комплексам и квартирам и привязывает их к локальным файлам (идемпотентно)."""
    added = 0
    demo_ids = {pid for items in COMPLEX_PHOTOS.values() for pid, _ in items}

    def is_demo(p):
        return _pid(p.url) in demo_ids and (not p.image or p.image.name.startswith("demo/"))

    for c in ResidentialComplex.objects.all():
        items = COMPLEX_PHOTOS.get(c.slug, COMPLEX_PHOTOS["severnyi-park"])
        current = list(c.photos.all())
        if current:
            # Обновляем только демо-фото; загруженные/изменённые в админке не трогаем
            if not all(is_demo(p) for p in current) or [_pid(p.url) for p in current] == [pid for pid, _ in items]:
                continue
            c.photos.all().delete()
        ComplexPhoto.objects.bulk_create(
            ComplexPhoto(complex=c, url=u(pid), image=local_photo(pid), caption=cap, order=i)
            for i, (pid, cap) in enumerate(items)
        )
        added += len(items)

    batch = []
    for a in Apartment.objects.filter(photos__isnull=True).only("id", "finishing"):
        pool = INTERIORS.get(a.finishing) or INTERIORS[Apartment.Finishing.FINE]
        # разный порядок фото у разных квартир, чтобы каталог не выглядел одинаково
        shift = a.id % len(pool)
        ordered = pool[shift:] + pool[:shift]
        for i, (pid, cap) in enumerate(ordered[:4]):
            batch.append(ApartmentPhoto(apartment_id=a.id, url=u(pid, 1400), image=local_photo(pid), caption=cap, order=i))
    ApartmentPhoto.objects.bulk_create(batch, batch_size=500)
    added += len(batch)

    # Уже существующие демо-фото (из прошлых версий, где были только ссылки) переводим на локальные файлы
    linked = 0
    all_ids = demo_ids | {pid for items in INTERIORS.values() for pid, _ in items}
    for pid in all_ids:
        name = local_photo(pid)
        if not name:
            continue
        for model in (ComplexPhoto, ApartmentPhoto):
            linked += (
                model.objects.filter(url__contains=f"photo-{pid}")
                .filter(Q(image="") | Q(image__startswith="demo/"))
                .exclude(image=name)
                .update(image=name)
            )
    if stdout and (added or linked):
        stdout.write(f"Демо-фото: добавлено {added}, переведено на локальные файлы {linked}")
    return added
