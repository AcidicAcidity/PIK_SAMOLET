import django_filters as df

from .models import Apartment


class NumberInFilter(df.BaseInFilter, df.NumberFilter):
    pass


class ApartmentFilter(df.FilterSet):
    complex = df.NumberFilter(field_name="building__complex_id")
    complex_slug = df.CharFilter(field_name="building__complex__slug")
    rooms = NumberInFilter(field_name="rooms", lookup_expr="in")
    rooms_min = df.NumberFilter(field_name="rooms", lookup_expr="gte")
    price_min = df.NumberFilter(field_name="price", lookup_expr="gte")
    price_max = df.NumberFilter(field_name="price", lookup_expr="lte")
    area_min = df.NumberFilter(field_name="area", lookup_expr="gte")
    area_max = df.NumberFilter(field_name="area", lookup_expr="lte")
    floor_min = df.NumberFilter(field_name="floor", lookup_expr="gte")
    floor_max = df.NumberFilter(field_name="floor", lookup_expr="lte")
    finishing = df.BaseInFilter(field_name="finishing", lookup_expr="in")
    status = df.BaseInFilter(field_name="status", lookup_expr="in")
    ids = NumberInFilter(field_name="id", lookup_expr="in")
    balcony = df.BooleanFilter()
    not_first_floor = df.BooleanFilter(method="filter_not_first")

    class Meta:
        model = Apartment
        fields = ("building",)

    def filter_not_first(self, qs, name, value):
        return qs.exclude(floor=1) if value else qs
